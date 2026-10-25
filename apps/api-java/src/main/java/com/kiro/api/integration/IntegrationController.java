package com.kiro.api.integration;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URI;
import java.util.Set;

@RestController @RequestMapping("/integrations") @Validated
public class IntegrationController {
  private final IntegrationService service;
  private final String webUrl;
  public IntegrationController(IntegrationService service,@Value("${KIRO_WEB_URL:http://localhost:3000}") String webUrl) {
    this.service=service;this.webUrl=webUrl;
    try {var uri=URI.create(webUrl);String host=uri.getHost();boolean local=host!=null&&Set.of("localhost","127.0.0.1").contains(host);
      if(host==null||!("https".equals(uri.getScheme())||local&&"http".equals(uri.getScheme()))||uri.getUserInfo()!=null||uri.getFragment()!=null)
        throw new IllegalStateException("KIRO_WEB_URL must be an HTTPS origin (HTTP is allowed on localhost)");
    } catch(IllegalArgumentException e){throw new IllegalStateException("KIRO_WEB_URL is invalid",e);}
  }
  @GetMapping("/catalog") public Object catalog(@AuthenticationPrincipal AuthenticatedPrincipal u) { return service.catalog(u); }
  @GetMapping public Object list(@AuthenticationPrincipal AuthenticatedPrincipal u) { return service.list(u); }
  @PostMapping public Object create(@AuthenticationPrincipal AuthenticatedPrincipal u,@Valid @RequestBody IntegrationService.ConnectionInput b) { return service.create(u,b); }
  @PutMapping("/{id}/credential") public Object credential(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@Valid @RequestBody IntegrationService.TokenInput b) { return service.credential(u,id,b.token()); }
  @DeleteMapping("/{id}") public Object disconnect(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.disconnect(u,id); }
  @DeleteMapping("/{id}/data") public void deleteData(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { service.deleteData(u,id); }
  @PostMapping("/{id}/xero/authorize") public Object authorizeXero(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.startXeroOAuth(u,id); }
  @GetMapping("/{id}/xero/tenants") public Object xeroTenants(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.xeroTenants(u,id); }
  public record XeroTenantInput(@jakarta.validation.constraints.NotBlank String tenantId) {}
  @PostMapping("/{id}/xero/tenant") public Object selectXeroTenant(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@jakarta.validation.Valid @RequestBody XeroTenantInput body) { return service.selectXeroTenant(u,id,body.tenantId()); }
  @GetMapping("/xero/callback") public ResponseEntity<Void> xeroCallback(@RequestParam(required=false) String state,@RequestParam(required=false) String code,@RequestParam(required=false) String error) {
    boolean success=false;try { service.completeXeroOAuth(state,error==null?code:null);success=true; } catch(org.springframework.web.server.ResponseStatusException ignored) { }
    URI target=UriComponentsBuilder.fromUriString(webUrl).replacePath("/app").replaceQuery(null).queryParam("integration","xero").queryParam("oauth",success?"success":"error").build().toUri();
    return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION,target.toString()).build();
  }
  @PostMapping("/{id}/sync") public Object sync(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.sync(u,id); }
  @GetMapping("/{id}/records") public Object records(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id,@RequestParam(defaultValue="0") @Min(0) int offset) { return service.records(u,id,offset); }
  @GetMapping("/{id}/runs") public Object runs(@AuthenticationPrincipal AuthenticatedPrincipal u,@PathVariable String id) { return service.runs(u,id); }
}
