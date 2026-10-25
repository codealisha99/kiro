package com.kiro.api.integration;

import com.fasterxml.jackson.databind.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.math.BigDecimal;
import java.util.*;
import java.security.MessageDigest;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Read-only official API adapters. Imported text is data, never executable instructions. */
@Component
public class ProviderGateway {
  public record MetricObservation(String metric,BigDecimal value,String unit,String start,String end,String campaign,String currency) {}
  public record SourceRecord(String externalId,String kind,String title,String status,String url,String updatedAt,
      BigDecimal amount,String currency,String department,String supervisor,MetricObservation metric) {
    public SourceRecord(String externalId,String kind,String title,String status,String url,String updatedAt,BigDecimal amount,String currency,String department,String supervisor) {
      this(externalId,kind,title,status,url,updatedAt,amount,currency,department,supervisor,null);
    }
  }
  public record Page(List<SourceRecord> records,String nextCursor) {}
  public record Reply(int status,String body,String retryAfter) {}
  public interface Transport { Reply send(HttpRequest request) throws Exception; }
  public static class ProviderFailure extends RuntimeException {
    public final String code; public final boolean retryable; public final int delaySeconds;
    public ProviderFailure(String code,boolean retryable,int delaySeconds) { super(code);this.code=code;this.retryable=retryable;this.delaySeconds=delaySeconds; }
  }
  private final ObjectMapper json; private final Transport transport;
  private final String xeroClientId,xeroClientSecret,xeroRedirectUri;
  private final String googleClientId,googleClientSecret,googleRedirectUri;
  public record XeroTokens(String accessToken,String refreshToken,int expiresIn) {}
  public record GoogleTokens(String accessToken,String refreshToken,int expiresIn) {}
  public record XeroTenant(String tenantId,String tenantName) {}
  @Autowired public ProviderGateway(ObjectMapper json,@Value("${XERO_CLIENT_ID:}") String clientId,
      @Value("${XERO_CLIENT_SECRET:}") String clientSecret,@Value("${XERO_REDIRECT_URI:}") String redirectUri,
      @Value("${GOOGLE_ANALYTICS_CLIENT_ID:}") String googleId,@Value("${GOOGLE_ANALYTICS_CLIENT_SECRET:}") String googleSecret,
      @Value("${GOOGLE_ANALYTICS_REDIRECT_URI:}") String googleRedirect) {
    this(json,new HttpTransport(),clientId,clientSecret,redirectUri,googleId,googleSecret,googleRedirect);
  }
  ProviderGateway(ObjectMapper json,Transport transport) { this(json,transport,"","",""); }
  ProviderGateway(ObjectMapper json,Transport transport,String clientId,String clientSecret,String redirectUri) {
    this(json,transport,clientId,clientSecret,redirectUri,"","","");
  }
  ProviderGateway(ObjectMapper json,Transport transport,String clientId,String clientSecret,String redirectUri,String googleId,String googleSecret,String googleRedirect) {
    this.json=json;this.transport=transport;this.xeroClientId=clientId;this.xeroClientSecret=clientSecret;this.xeroRedirectUri=redirectUri;
    this.googleClientId=googleId;this.googleClientSecret=googleSecret;this.googleRedirectUri=googleRedirect;
  }
  public boolean xeroOAuthConfigured() {
    if(xeroClientId.isBlank()||xeroClientSecret.isBlank()||xeroRedirectUri.isBlank())return false;
    try {var u=URI.create(xeroRedirectUri);return "https".equals(u.getScheme())&&u.getHost()!=null || "http".equals(u.getScheme())&&Set.of("localhost","127.0.0.1").contains(u.getHost());}
    catch(Exception e){return false;}
  }
  public String xeroAuthorizationUrl(String state,String verifier) {
    if(!xeroOAuthConfigured())throw new ProviderFailure("XERO_OAUTH_NOT_CONFIGURED",false,0);
    try {
      String challenge=Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
      return "https://login.xero.com/identity/connect/authorize?response_type=code&client_id="+q(xeroClientId)+"&redirect_uri="+q(xeroRedirectUri)+"&scope="+q("accounting.transactions.read offline_access")+"&state="+q(state)+"&code_challenge="+q(challenge)+"&code_challenge_method=S256";
    } catch(Exception e){throw new IllegalStateException("Could not prepare Xero authorization");}
  }
  public boolean googleAnalyticsOAuthConfigured() { return validOAuthClient(googleClientId,googleClientSecret,googleRedirectUri); }
  public String googleAnalyticsAuthorizationUrl(String state,String verifier) {
    if(!googleAnalyticsOAuthConfigured())throw new ProviderFailure("GOOGLE_ANALYTICS_OAUTH_NOT_CONFIGURED",false,0);
    try {
      String challenge=Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
      return "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id="+q(googleClientId)+"&redirect_uri="+q(googleRedirectUri)
          +"&scope="+q("https://www.googleapis.com/auth/analytics.readonly")+"&access_type=offline&include_granted_scopes=true&prompt=consent&state="+q(state)
          +"&code_challenge="+q(challenge)+"&code_challenge_method=S256";
    } catch(Exception e){throw new IllegalStateException("Could not prepare Google Analytics authorization");}
  }
  public GoogleTokens exchangeGoogleAnalyticsCode(String code,String verifier) {
    return googleTokenRequest(Map.of("grant_type","authorization_code","code",code,"redirect_uri",googleRedirectUri,"code_verifier",verifier),false,null);
  }
  public GoogleTokens refreshGoogleAnalyticsToken(String refreshToken) {
    return googleTokenRequest(Map.of("grant_type","refresh_token","refresh_token",refreshToken),true,refreshToken);
  }
  private GoogleTokens googleTokenRequest(Map<String,String> fields,boolean refresh,String existingRefreshToken) {
    if(!googleAnalyticsOAuthConfigured())throw new ProviderFailure("GOOGLE_ANALYTICS_OAUTH_NOT_CONFIGURED",false,0);
    try {
      var form=new HashMap<>(fields);form.put("client_id",googleClientId);form.put("client_secret",googleClientSecret);
      String body=form.entrySet().stream().map(e->q(e.getKey())+"="+q(e.getValue())).collect(java.util.stream.Collectors.joining("&"));
      var req=HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token")).timeout(Duration.ofSeconds(20))
          .header("Accept","application/json").header("Content-Type","application/x-www-form-urlencoded")
          .POST(HttpRequest.BodyPublishers.ofString(body)).build();
      Reply reply=transport.send(req);
      if(reply.status()<200||reply.status()>=300) {
        String code=refresh?(reply.status()==400?"GOOGLE_REFRESH_REAUTH":"GOOGLE_REFRESH_OUTCOME_UNKNOWN"):"GOOGLE_OAUTH_EXCHANGE_FAILED";
        throw new ProviderFailure(code,false,0);
      }
      JsonNode token=json.readTree(reply.body());String access=required(token,"access_token");int expiry=token.path("expires_in").asInt(0);
      String rotated=text(token,"refresh_token"),refreshToken=rotated==null||rotated.isBlank()?existingRefreshToken:rotated;
      if(expiry<1||refreshToken==null||refreshToken.isBlank())throw new ProviderFailure(refresh?"GOOGLE_REFRESH_OUTCOME_UNKNOWN":"GOOGLE_OAUTH_REFRESH_TOKEN_MISSING",false,0);
      if(!refresh&&!Arrays.asList(required(token,"scope").split("\\s+")).contains("https://www.googleapis.com/auth/analytics.readonly"))throw new ProviderFailure("GOOGLE_OAUTH_SCOPE_NOT_GRANTED",false,0);
      return new GoogleTokens(access,refreshToken,expiry);
    } catch(ProviderFailure e){throw e;}
    catch(InterruptedException e){Thread.currentThread().interrupt();throw new ProviderFailure(refresh?"GOOGLE_REFRESH_OUTCOME_UNKNOWN":"GOOGLE_OAUTH_EXCHANGE_FAILED",false,0);}
    catch(Exception e){throw new ProviderFailure(refresh?"GOOGLE_REFRESH_OUTCOME_UNKNOWN":"GOOGLE_OAUTH_EXCHANGE_FAILED",false,0);}
  }
  private static boolean validOAuthClient(String id,String secret,String redirect) {
    if(id==null||id.isBlank()||secret==null||secret.isBlank()||redirect==null||redirect.isBlank())return false;
    try {var u=URI.create(redirect);String host=u.getHost();boolean local=host!=null&&Set.of("localhost","127.0.0.1").contains(host);
      return ("https".equals(u.getScheme())||local&&"http".equals(u.getScheme()))&&host!=null&&u.getUserInfo()==null&&u.getFragment()==null&&u.getQuery()==null;
    } catch(Exception e){return false;}
  }
  public XeroTokens exchangeXeroCode(String code,String verifier) { return xeroTokenRequest(Map.of("grant_type","authorization_code","code",code,"redirect_uri",xeroRedirectUri,"code_verifier",verifier),false); }
  public XeroTokens refreshXeroToken(String refreshToken) { return xeroTokenRequest(Map.of("grant_type","refresh_token","refresh_token",refreshToken),true); }
  public List<XeroTenant> xeroTenants(String accessToken) {
    var result=request("https://api.xero.com/connections","Bearer "+accessToken,null,Map.of());var tenants=new ArrayList<XeroTenant>();
    for(var row:array(result))tenants.add(new XeroTenant(required(row,"tenantId"),Objects.requireNonNullElse(text(row,"tenantName"),"Xero organization")));
    if(tenants.isEmpty())throw new ProviderFailure("XERO_NO_AUTHORIZED_TENANTS",false,0);
    return List.copyOf(tenants);
  }
  private XeroTokens xeroTokenRequest(Map<String,String> fields,boolean refresh) {
    if(!xeroOAuthConfigured())throw new ProviderFailure("XERO_OAUTH_NOT_CONFIGURED",false,0);
    try {
      String form=fields.entrySet().stream().map(e->q(e.getKey())+"="+q(e.getValue())).collect(java.util.stream.Collectors.joining("&"));
      String basic=Base64.getEncoder().encodeToString((xeroClientId+":"+xeroClientSecret).getBytes(StandardCharsets.UTF_8));
      var req=HttpRequest.newBuilder(URI.create("https://identity.xero.com/connect/token")).timeout(Duration.ofSeconds(20))
          .header("Authorization","Basic "+basic).header("Accept","application/json").header("Content-Type","application/x-www-form-urlencoded")
          .POST(HttpRequest.BodyPublishers.ofString(form)).build();
      Reply reply=transport.send(req);
      if(reply.status()<200||reply.status()>=300) {
        String code=refresh?(reply.status()==400||reply.status()==401?"XERO_REFRESH_REAUTH":"XERO_REFRESH_OUTCOME_UNKNOWN"):"XERO_OAUTH_EXCHANGE_FAILED";
        throw new ProviderFailure(code,false,0);
      }
      JsonNode jsonToken=json.readTree(reply.body());
      return new XeroTokens(required(jsonToken,"access_token"),required(jsonToken,"refresh_token"),jsonToken.path("expires_in").asInt(0));
    } catch(ProviderFailure e){throw e;}
    catch(InterruptedException e){Thread.currentThread().interrupt();throw new ProviderFailure(refresh?"XERO_REFRESH_OUTCOME_UNKNOWN":"XERO_OAUTH_EXCHANGE_FAILED",false,0);}
    catch(Exception e){throw new ProviderFailure(refresh?"XERO_REFRESH_OUTCOME_UNKNOWN":"XERO_OAUTH_EXCHANGE_FAILED",false,0);}
  }
  private static class HttpTransport implements Transport {
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    public Reply send(HttpRequest request) throws Exception {
      var future=client.sendAsync(request,info->new BoundedBody());
      try {
        var r=future.get(25,java.util.concurrent.TimeUnit.SECONDS);
        return new Reply(r.statusCode(),new String(r.body(),StandardCharsets.UTF_8),r.headers().firstValue("Retry-After").orElse("60"));
      } catch(java.util.concurrent.TimeoutException e) {
        future.cancel(true);throw new ProviderFailure("PROVIDER_TIMEOUT",true,60);
      } catch(java.util.concurrent.ExecutionException e) {
        if(e.getCause() instanceof ProviderFailure failure) throw failure;
        throw e;
      }
    }
  }
  private static class BoundedBody implements HttpResponse.BodySubscriber<byte[]> {
    private final java.util.concurrent.CompletableFuture<byte[]> result=new java.util.concurrent.CompletableFuture<>();
    private final java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
    private java.util.concurrent.Flow.Subscription subscription;
    public java.util.concurrent.CompletionStage<byte[]> getBody() { return result; }
    public void onSubscribe(java.util.concurrent.Flow.Subscription s) { subscription=s;s.request(1); }
    public void onNext(List<java.nio.ByteBuffer> chunks) {
      for(var chunk:chunks) {
        if(bytes.size()+chunk.remaining()>2_000_000) { subscription.cancel();result.completeExceptionally(new ProviderFailure("RESPONSE_TOO_LARGE",false,0));return; }
        byte[] data=new byte[chunk.remaining()];chunk.get(data);bytes.writeBytes(data);
      }
      subscription.request(1);
    }
    public void onError(Throwable error) { result.completeExceptionally(error); }
    public void onComplete() { result.complete(bytes.toByteArray()); }
  }
  public void validate(String provider,String resource,String account) {
    boolean valid=switch(provider) {
      case "github" -> resource.matches("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+") && !resource.contains("..");
      case "slack" -> resource.matches("C[A-Z0-9]{5,}") && account.matches("[a-z0-9][a-z0-9-]{0,62}");
      case "linear","xero" -> resource.matches("[0-9a-fA-F-]{36}");
      case "hubspot","googleanalytics" -> resource.matches("[0-9]{1,20}");
      case "bamboohr" -> resource.matches("[a-z0-9][a-z0-9-]{0,62}");
      default -> false;
    };
    if(!valid) throw new ProviderFailure("INVALID_PROVIDER_RESOURCE",false,0);
  }
  private static String q(String value) { return URLEncoder.encode(value,StandardCharsets.UTF_8); }
  /** One attempt only. Callers must persist approval and execution state before invoking. */
  public Map<String,String> createGitHubIssue(String repository,String token,String title,String body,String actionId) {
    validate("github",repository,"");
    var result=request("https://api.github.com/repos/"+repository+"/issues","Bearer "+token,
        json.createObjectNode().put("title",title).put("body",body+"\n\n<!-- kiro-action:"+actionId+" -->").toString(),
        Map.of("X-GitHub-Api-Version","2026-03-10"));
    String number=required(result,"number");
    if(!number.matches("[0-9]+"))throw new ProviderFailure("INVALID_ACTION_RESULT",false,0);
    return Map.of("externalId",required(result,"id"),"url","https://github.com/"+repository+"/issues/"+number);
  }
  private JsonNode request(String url,String auth,String body,Map<String,String> extra) {
    try {
      var b=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20)).header("Authorization",auth).header("Accept","application/json");
      extra.forEach(b::header);
      if(body!=null) b.header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)); else b.GET();
      Reply reply=transport.send(b.build());
      if(reply.status()==429 || reply.status()>=500) {
        int retry=60;try {retry=Math.min(86400,Math.max(60,Integer.parseInt(reply.retryAfter())));}catch(NumberFormatException ignored) {}
        throw new ProviderFailure("PROVIDER_HTTP_"+reply.status(),true,retry);
      }
      if(reply.status()<200 || reply.status()>=300) throw new ProviderFailure("PROVIDER_HTTP_"+reply.status(),false,0);
      JsonNode result=json.readTree(reply.body());
      if(result==null) throw new ProviderFailure("INVALID_PROVIDER_RESPONSE",false,0);
      return result;
    } catch(ProviderFailure e) { throw e; }
    catch(InterruptedException e) { Thread.currentThread().interrupt();throw new ProviderFailure("REQUEST_INTERRUPTED",true,60); }
    catch(Exception e) { throw new ProviderFailure("PROVIDER_UNAVAILABLE",true,60); }
  }
  private static String text(JsonNode n,String field) { var v=n.path(field);return v.isMissingNode()||v.isNull()?null:v.asText(); }
  private static String required(JsonNode n,String field) {
    String v=text(n,field);if(v==null || v.isBlank()) throw new ProviderFailure("INVALID_PROVIDER_RESPONSE",false,0);return v;
  }
  private static JsonNode array(JsonNode n) { if(!n.isArray()) throw new ProviderFailure("INVALID_PROVIDER_RESPONSE",false,0);return n; }
  private static BigDecimal amount(String n) {
    if(n==null||n.isBlank())return null;
    try {return new BigDecimal(n);}catch(NumberFormatException e){throw new ProviderFailure("INVALID_AMOUNT",false,0);}
  }
  private static String safeUrl(String value,String host) {
    try { var uri=URI.create(value);return "https".equals(uri.getScheme())&&host.equals(uri.getHost())?value:null; }
    catch(Exception e) {return null;}
  }
  public Page fetch(String provider,String resource,String account,String token,String cursor) {
    validate(provider,resource,account);
    List<SourceRecord> records=new ArrayList<>(); String next=null;String bearer="Bearer "+token;
    switch(provider) {
      case "googleanalytics" -> {
        // Freeze absolute date bounds in the cursor so pages crossing midnight use the same report.
        var end=java.time.LocalDate.now(java.time.ZoneOffset.UTC).minusDays(2);
        var start=end.minusDays(29);int offset=0;
        if(cursor!=null) {
          var parts=cursor.split(":");if(parts.length!=3)throw new ProviderFailure("INVALID_CURSOR",false,0);
          start=java.time.LocalDate.parse(parts[0]);end=java.time.LocalDate.parse(parts[1]);offset=Integer.parseInt(parts[2]);
          if(offset<0 || end.isBefore(start))throw new ProviderFailure("INVALID_CURSOR",false,0);
        }
        var body=json.createObjectNode();body.putArray("dateRanges").addObject().put("startDate",start.toString()).put("endDate",end.toString());
        body.putArray("dimensions").addObject().put("name","firstUserCampaignName");
        var names=List.of("sessions","keyEvents","totalRevenue");var metrics=body.putArray("metrics");names.forEach(n->metrics.addObject().put("name",n));
        body.put("limit","100").put("offset",String.valueOf(offset));
        body.putArray("orderBys").addObject().putObject("dimension").put("dimensionName","firstUserCampaignName");
        var report=request("https://analyticsdata.googleapis.com/v1beta/properties/"+resource+":runReport",bearer,body.toString(),Map.of());
        int total=report.path("rowCount").asInt(-1);if(total<0)throw new ProviderFailure("INVALID_PROVIDER_RESPONSE",false,0);
        var rows=report.path("rows");if(total==0 && rows.isMissingNode())rows=json.createArrayNode();
        for(var row:array(rows)) {
          String campaign=required(array(row.path("dimensionValues")).path(0),"value");var values=array(row.path("metricValues"));
          if(values.size()!=3)throw new ProviderFailure("INVALID_PROVIDER_RESPONSE",false,0);
          for(int n=0;n<3;n++) {
            String metric=names.get(n);BigDecimal value=amount(required(values.path(n),"value"));String currency=n==2?text(report.path("metadata"),"currencyCode"):null;
            var observation=new MetricObservation(metric,value,n==2?"currency":n==1?"events":"sessions",start.toString(),end.toString(),campaign,currency);
            String external=json.createArrayNode().add(start.toString()).add(end.toString()).add(campaign).add(metric).toString();
            records.add(new SourceRecord(external,"MARKETING_METRIC",campaign+" · "+metric,"REPORTED","https://analytics.google.com/analytics/web/#/p"+resource,null,null,null,null,null,observation));
          }
        }
        if(offset+rows.size()<total) {
          if(rows.isEmpty())throw new ProviderFailure("EMPTY_PROVIDER_PAGE",false,0);
          next=start+":"+end+":"+(offset+rows.size());
        }
      }
      case "github" -> {
        int page=cursor==null?1:Integer.parseInt(cursor);
        var rows=array(request("https://api.github.com/repos/"+resource+"/issues?state=all&per_page=100&sort=created&direction=asc&page="+page,
          bearer,null,Map.of("X-GitHub-Api-Version","2022-11-28")));
        for(var r:rows) records.add(new SourceRecord(required(r,"id"),r.has("pull_request")?"PULL_REQUEST":"ISSUE",required(r,"title"),text(r,"state"),safeUrl(text(r,"html_url"),"github.com"),text(r,"updated_at"),null,null,null,null));
        if(rows.size()==100)next=String.valueOf(page+1);
      }
      case "slack" -> {
        if(!token.startsWith("xoxb-"))throw new ProviderFailure("SLACK_BOT_TOKEN_REQUIRED",false,0);
        var info=request("https://slack.com/api/conversations.info?channel="+q(resource),bearer,null,Map.of());slackOk(info);
        var channel=info.path("channel");
        if(!channel.path("is_channel").asBoolean() || channel.path("is_private").asBoolean() || !channel.path("is_member").asBoolean())
          throw new ProviderFailure("PUBLIC_JOINED_CHANNEL_REQUIRED",false,0);
        var result=request("https://slack.com/api/conversations.history?limit=15&channel="+q(resource)+(cursor==null?"":"&cursor="+q(cursor)),bearer,null,Map.of());slackOk(result);
        for(var r:array(result.path("messages"))) {
          String ts=required(r,"ts");records.add(new SourceRecord(ts,"MESSAGE",Objects.requireNonNullElse(text(r,"text"),""),"OBSERVED",
            "https://"+account+".slack.com/archives/"+resource+"/p"+ts.replace(".",""),ts,null,null,null,null));
        }
        next=result.path("response_metadata").path("next_cursor").asText("");
        if(result.path("has_more").asBoolean() && next.isBlank()) throw new ProviderFailure("MISSING_PROVIDER_CURSOR",false,0);
      }
      case "linear" -> {
        try {
          Map<String,Object> variables=new HashMap<>();variables.put("team",resource);variables.put("after",cursor);
          String body=json.writeValueAsString(Map.of("query","query($team: ID!, $after: String) { team(id: $team) { issues(first: 100, after: $after, includeArchived: false) { nodes { id title url updatedAt state { name } } pageInfo { hasNextPage endCursor } } } }","variables",variables));
          var result=request("https://api.linear.app/graphql",token,body,Map.of());
          if(result.has("errors")) throw new ProviderFailure("LINEAR_GRAPHQL_ERROR",false,0);
          var issues=result.path("data").path("team").path("issues");
          for(var r:array(issues.path("nodes")))records.add(new SourceRecord(required(r,"id"),"TASK",required(r,"title"),text(r.path("state"),"name"),safeUrl(text(r,"url"),"linear.app"),text(r,"updatedAt"),null,null,null,null));
          if(issues.path("pageInfo").path("hasNextPage").asBoolean())next=required(issues.path("pageInfo"),"endCursor");
        }catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
      }
      case "hubspot" -> {
        var result=request("https://api.hubapi.com/crm/v3/objects/deals?limit=100&archived=false&properties=dealname,dealstage,amount,deal_currency_code"+(cursor==null?"":"&after="+q(cursor)),bearer,null,Map.of());
        for(var r:array(result.path("results"))) {
          var p=r.path("properties");String id=required(r,"id");
          records.add(new SourceRecord(id,"DEAL",Objects.requireNonNullElse(text(p,"dealname"),"Untitled deal"),text(p,"dealstage"),
            "https://app.hubspot.com/contacts/"+resource+"/record/0-3/"+q(id),text(r,"updatedAt"),amount(text(p,"amount")),text(p,"deal_currency_code"),null,null));
        }
        next=text(result.path("paging").path("next"),"after");
      }
      case "xero" -> {
        int page=cursor==null?1:Integer.parseInt(cursor);
        var result=request("https://api.xero.com/api.xro/2.0/Invoices?page="+page+"&pageSize=100",bearer,null,Map.of("xero-tenant-id",resource));
        var rows=array(result.path("Invoices"));
        for(var r:rows) records.add(new SourceRecord(required(r,"InvoiceID"),"INVOICE",Objects.requireNonNullElse(text(r,"InvoiceNumber"),"Invoice"),text(r,"Status"),
          "https://go.xero.com/"+("ACCPAY".equals(text(r,"Type"))?"AccountsPayable":"AccountsReceivable")+"/View.aspx?InvoiceID="+q(required(r,"InvoiceID")),text(r,"UpdatedDateUTC"),amount(text(r,"Total")),text(r,"CurrencyCode"),null,null));
        if(rows.size()==100)next=String.valueOf(page+1);
      }
      case "bamboohr" -> {
        var result=request("https://"+resource+".bamboohr.com/api/v1/employees/directory","Basic "+Base64.getEncoder().encodeToString((token+":x").getBytes(StandardCharsets.UTF_8)),null,Map.of());
        for(var r:array(result.path("employees"))) records.add(new SourceRecord(required(r,"id"),"EMPLOYEE",Objects.requireNonNullElse(text(r,"displayName"),"Employee"),text(r,"jobTitle"),null,null,null,null,text(r,"department"),text(r,"supervisor")));
      }
      default -> throw new ProviderFailure("UNSUPPORTED_PROVIDER",false,0);
    }
    if(next!=null && next.isBlank())next=null;
    if(next!=null && next.equals(cursor))throw new ProviderFailure("REPEATED_PROVIDER_CURSOR",false,0);
    return new Page(records,next);
  }
  private void slackOk(JsonNode result) {
    if(!result.path("ok").asBoolean()) {
      String code=result.path("error").asText();
      throw new ProviderFailure(code.equals("ratelimited")?"PROVIDER_HTTP_429":"SLACK_AUTH_OR_SCOPE_ERROR",code.equals("ratelimited"),60);
    }
  }
}
