package com.kiro.api.integration;

import com.fasterxml.jackson.databind.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Read-only official API adapters. Imported text is data, never executable instructions. */
@Component
public class ProviderGateway {
  public record SourceRecord(String externalId,String kind,String title,String status,String url,String updatedAt,
      BigDecimal amount,String currency,String department,String supervisor) {}
  public record Page(List<SourceRecord> records,String nextCursor) {}
  public record Reply(int status,String body,String retryAfter) {}
  public interface Transport { Reply send(HttpRequest request) throws Exception; }
  public static class ProviderFailure extends RuntimeException {
    public final String code; public final boolean retryable; public final int delaySeconds;
    public ProviderFailure(String code,boolean retryable,int delaySeconds) { super(code);this.code=code;this.retryable=retryable;this.delaySeconds=delaySeconds; }
  }
  private final ObjectMapper json; private final Transport transport;
  @Autowired public ProviderGateway(ObjectMapper json) { this(json,new HttpTransport()); }
  ProviderGateway(ObjectMapper json,Transport transport) { this.json=json;this.transport=transport; }
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
      case "hubspot" -> resource.matches("[0-9]{1,20}");
      case "bamboohr" -> resource.matches("[a-z0-9][a-z0-9-]{0,62}");
      default -> false;
    };
    if(!valid) throw new ProviderFailure("INVALID_PROVIDER_RESOURCE",false,0);
  }
  private static String q(String value) { return URLEncoder.encode(value,StandardCharsets.UTF_8); }
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
