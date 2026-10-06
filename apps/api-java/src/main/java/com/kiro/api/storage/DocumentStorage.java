package com.kiro.api.storage;

import com.kiro.api.config.AppProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

public interface DocumentStorage {
  /** Persists bytes under key, returns the stored path/URI. */
  String put(String key, byte[] content) throws IOException;

  byte[] get(String key) throws IOException;
}

@Service
class LocalDocumentStorage implements DocumentStorage {

  private static final Logger log = LoggerFactory.getLogger(LocalDocumentStorage.class);
  private final Path dir;

  LocalDocumentStorage(AppProperties props) {
    if ("s3".equalsIgnoreCase(props.storageDriver())) {
      // S3 client is not wired in this build — same behavior as NestJS: warn + local fallback.
      log.warn("STORAGE_DRIVER=s3 configured but no S3 client wired — falling back to local");
    }
    this.dir = Path.of(props.storageDir());
  }

  @Override
  public String put(String key, byte[] content) throws IOException {
    Path target = dir.resolve(key).normalize();
    if (!target.startsWith(dir)) throw new IOException("Invalid storage key");
    Files.createDirectories(target.getParent());
    Files.write(target, content);
    return target.toString();
  }

  @Override
  public byte[] get(String key) throws IOException {
    Path target = dir.resolve(key).normalize();
    if (!target.startsWith(dir) || !Files.exists(target)) return null;
    return Files.readAllBytes(target);
  }
}
