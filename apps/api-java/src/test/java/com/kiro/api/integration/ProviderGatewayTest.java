package com.kiro.api.integration;
import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.net.http.HttpRequest;
import org.junit.jupiter.api.Test;

class ProviderGatewayTest {
 @Test void analyticsPreservesTypedMetricsAndFixedPaginationDates() {
  var requests=new ArrayList<HttpRequest>();
  var g=gateway("{\"rowCount\":2,\"rows\":[{\"dimensionValues\":[{\"value\":\"Launch\"}],\"metricValues\":[{\"value\":\"100\"},{\"value\":\"5\"},{\"value\":\"12.50\"}]}],\"metadata\":{\"currencyCode\":\"USD\"}}",requests);
  var page=g.fetch("googleanalytics","12345","","token",null);
  assertEquals(3,page.records().size());assertNotNull(page.nextCursor());
  assertEquals("sessions",page.records().getFirst().metric().unit());
  assertEquals("USD",page.records().getLast().metric().currency());
  assertEquals(new java.math.BigDecimal("12.50"),page.records().getLast().metric().value());
  assertEquals("analyticsdata.googleapis.com",requests.getFirst().uri().getHost());
  var next=g.fetch("googleanalytics","12345","","token",page.nextCursor());
  assertEquals(page.records().getFirst().metric().start(),next.records().getFirst().metric().start());assertNull(next.nextCursor());
  assertTrue(gateway("{\"rowCount\":0}",new ArrayList<>()).fetch("googleanalytics","123","","token",null).records().isEmpty());
 }
 @Test void issueCreationSendsExactApprovedContentAndStableReconciliationMarker() throws Exception {
  var requests=new ArrayList<HttpRequest>();
  var g=new ProviderGateway(new ObjectMapper(),r->{requests.add(r);return new ProviderGateway.Reply(201,"{\"id\":123,\"number\":7}","60");});
  assertEquals("https://github.com/a/b/issues/7",g.createGitHubIssue("a/b","test-token","Exact title","Exact body","action-1").get("url"));
  var request=requests.getFirst();assertEquals("POST",request.method());assertEquals("https://api.github.com/repos/a/b/issues",request.uri().toString());
  var bytes=new java.io.ByteArrayOutputStream();var done=new java.util.concurrent.CompletableFuture<Void>();
  request.bodyPublisher().orElseThrow().subscribe(new java.util.concurrent.Flow.Subscriber<java.nio.ByteBuffer>() {
   public void onSubscribe(java.util.concurrent.Flow.Subscription s){s.request(Long.MAX_VALUE);}
   public void onNext(java.nio.ByteBuffer b){byte[] part=new byte[b.remaining()];b.get(part);bytes.writeBytes(part);}
   public void onError(Throwable t){done.completeExceptionally(t);}
   public void onComplete(){done.complete(null);}
  });
  done.get(2,java.util.concurrent.TimeUnit.SECONDS);
  var body=new ObjectMapper().readTree(bytes.toByteArray());
  assertEquals("Exact title",body.path("title").asText());assertEquals("Exact body\n\n<!-- kiro-action:action-1 -->",body.path("body").asText());
  assertThrows(ProviderGateway.ProviderFailure.class,()->g.createGitHubIssue("../private","token","Title","Body","a"));
 }
 ProviderGateway gateway(String body,List<HttpRequest> requests) {return new ProviderGateway(new ObjectMapper(),r->{requests.add(r);return new ProviderGateway.Reply(200,body,"60");});}
 @Test void githubNormalizesIssueAndUsesReadOnlyOfficialEndpoint() {
  var requests=new ArrayList<HttpRequest>();var g=gateway("[{\"id\":1,\"title\":\"Issue\",\"state\":\"open\",\"html_url\":\"https://github.com/a/b/issues/1\"}]",requests);
  var p=g.fetch("github","a/b","","test-token",null);assertEquals("ISSUE",p.records().getFirst().kind());assertNull(p.nextCursor());
  assertEquals("api.github.com",requests.getFirst().uri().getHost());assertEquals("GET",requests.getFirst().method());
  assertFalse(requests.getFirst().uri().toString().contains("test-token"));
 }
 @Test void slackRequiresExplicitPublicJoinedChannelAndHonorsCursor() {
  var queue=new ArrayDeque<>(List.of("{\"ok\":true,\"channel\":{\"is_channel\":true,\"is_member\":true,\"is_private\":false}}",
   "{\"ok\":true,\"messages\":[{\"ts\":\"123.456\",\"text\":\"Untrusted message\"}],\"has_more\":true,\"response_metadata\":{\"next_cursor\":\"next\"}}"));
  var g=new ProviderGateway(new ObjectMapper(),r->new ProviderGateway.Reply(200,queue.remove(),"60"));
  var p=g.fetch("slack","C123456","test","xoxb-test",null);assertEquals("next",p.nextCursor());assertEquals("MESSAGE",p.records().getFirst().kind());
  var privateChannel=gateway("{\"ok\":true,\"channel\":{\"is_channel\":true,\"is_member\":true,\"is_private\":true}}",new ArrayList<>());
  assertThrows(ProviderGateway.ProviderFailure.class,()->privateChannel.fetch("slack","C123456","test","xoxb-test",null));
 }
 @Test void linearDetectsGraphqlFailuresAndUsesTeamFilter() {
  var requests=new ArrayList<HttpRequest>();var g=gateway("{\"data\":{\"team\":{\"issues\":{\"nodes\":[{\"id\":\"task\",\"title\":\"Task\",\"state\":{\"name\":\"Todo\"}}],\"pageInfo\":{\"hasNextPage\":false}}}}}",requests);
  assertEquals("TASK",g.fetch("linear","12345678-1234-1234-1234-123456789012","","token",null).records().getFirst().kind());
  assertEquals("POST",requests.getFirst().method());
  assertThrows(ProviderGateway.ProviderFailure.class,()->gateway("{\"errors\":[{}]}",requests).fetch("linear","12345678-1234-1234-1234-123456789012","","token",null));
 }
 @Test void hubspotXeroAndBambooUseTypedFactsAndMinimalFields() {
  var requests=new ArrayList<HttpRequest>();
  var deal=gateway("{\"results\":[{\"id\":\"1\",\"properties\":{\"dealname\":\"Renewal\",\"amount\":\"12.50\",\"deal_currency_code\":\"USD\"}}],\"paging\":{\"next\":{\"after\":\"2\"}}}",requests).fetch("hubspot","123","","token",null);
  assertEquals("2",deal.nextCursor());assertEquals("USD",deal.records().getFirst().currency());
  var invoice=gateway("{\"Invoices\":[{\"InvoiceID\":\"id\",\"InvoiceNumber\":\"INV-1\",\"Total\":12,\"CurrencyCode\":\"GBP\"}]}",requests).fetch("xero","12345678-1234-1234-1234-123456789012","","token",null);
  assertEquals("INVOICE",invoice.records().getFirst().kind());assertTrue(requests.getLast().headers().firstValue("xero-tenant-id").isPresent());
  var people=gateway("{\"employees\":[{\"id\":\"1\",\"displayName\":\"Synthetic Person\",\"department\":\"Sales\",\"supervisor\":\"Example Manager\"}]}",requests).fetch("bamboohr","example","","token",null);
  assertEquals("Sales",people.records().getFirst().department());assertTrue(requests.getLast().headers().firstValue("Authorization").orElseThrow().startsWith("Basic "));
 }
 @Test void rejectsUnsafeHostsMalformedPagesAndRateLimitsWithoutLeakingBodies() {
  var g=gateway("{}",new ArrayList<>());
  assertThrows(ProviderGateway.ProviderFailure.class,()->g.fetch("bamboohr","localhost/../","","token",null));
  assertThrows(ProviderGateway.ProviderFailure.class,()->g.fetch("github","a/b","","token",null));
  var rate=new ProviderGateway(new ObjectMapper(),r->new ProviderGateway.Reply(429,"SECRET BODY","120"));
  var e=assertThrows(ProviderGateway.ProviderFailure.class,()->rate.fetch("github","a/b","","token",null));
  assertTrue(e.retryable);assertEquals(120,e.delaySeconds);assertFalse(e.getMessage().contains("SECRET"));
 }
 @Test void encryptionIsRandomizedTenantBoundAndFailsWithoutKey() {
  var v=new CredentialVault(Base64.getEncoder().encodeToString(new byte[32]));
  String encrypted=v.encrypt("credential","tenant:connection");assertEquals("credential",v.decrypt(encrypted,"tenant:connection"));
  assertNotEquals(encrypted,v.encrypt("credential","tenant:connection"));
  assertThrows(IllegalStateException.class,()->v.decrypt(encrypted,"other:connection"));
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->new CredentialVault("").encrypt("credential","context"));
 }
}
