package com.kiro.api.document;

import com.kiro.api.ingestion.AclGrantInput;
import com.kiro.api.ingestion.IngestionService;
import com.kiro.api.security.AuthenticatedPrincipal;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

record IngestBody(
    @NotBlank String title,
    @NotBlank String content,
    String classification,
    List<AclGrantInput> acl) {}

record RevokeBody(@NotBlank String principalType, @NotBlank String principalId) {}

@RestController
@RequestMapping("/documents")
class DocumentController {

  private final IngestionService ingestion;

  DocumentController(IngestionService ingestion) {
    this.ingestion = ingestion;
  }

  @GetMapping
  public List<Map<String, Object>> list(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return ingestion.listDocuments(user);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> ingest(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestBody @jakarta.validation.Valid IngestBody body) {
    if (body.classification() != null
        && !List.of("public", "internal", "confidential", "restricted")
            .contains(body.classification().toLowerCase())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid classification");
    }
    return ingestion.ingestManualDocument(user, body.title(), body.content(),
        body.classification(), body.acl(), null, null, null);
  }

  @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> upload(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @RequestParam("file") MultipartFile file,
      @RequestParam(value = "title", required = false) String title,
      @RequestParam(value = "classification", required = false) String classification) {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Attach a file under the field name \"file\"");
    }
    try {
      return ingestion.ingestUploadedFile(user, file.getBytes(), file.getOriginalFilename(),
          file.getContentType(), title, classification);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload failed");
    }
  }

  @PostMapping("/demo")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> seedDemo(@AuthenticationPrincipal AuthenticatedPrincipal user) {
    return ingestion.seedDemo(user);
  }

  @GetMapping("/{id}/versions")
  public List<Map<String, Object>> versions(
      @AuthenticationPrincipal AuthenticatedPrincipal user, @PathVariable String id) {
    return ingestion.listVersions(user, id);
  }

  @GetMapping("/{id}")
  public Map<String, Object> get(
      @AuthenticationPrincipal AuthenticatedPrincipal user, @PathVariable String id) {
    return ingestion.getDocument(user, id);
  }

  @DeleteMapping("/{id}")
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal AuthenticatedPrincipal user, @PathVariable String id) {
    return ingestion.deleteDocument(user, id);
  }

  @PostMapping("/{id}/revoke")
  public Map<String, Boolean> revoke(
      @AuthenticationPrincipal AuthenticatedPrincipal user,
      @PathVariable String id,
      @RequestBody @jakarta.validation.Valid RevokeBody body) {
    return ingestion.revokeAccess(user, id, body.principalType(), body.principalId());
  }
}
