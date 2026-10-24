package com.kiro.api.integration;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Component
public class CredentialVault {
  private final byte[] key;
  public CredentialVault(@Value("${INTEGRATION_ENCRYPTION_KEY:}") String encoded) {
    if(encoded.isBlank()) { key=null;return; }
    try { key=Base64.getDecoder().decode(encoded); }
    catch(IllegalArgumentException e) { throw new IllegalStateException("INTEGRATION_ENCRYPTION_KEY must be base64"); }
    if(key.length!=32) throw new IllegalStateException("INTEGRATION_ENCRYPTION_KEY must encode 32 bytes");
  }
  public boolean available() { return key!=null; }
  public String encrypt(String token,String context) {
    if(key==null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Configure INTEGRATION_ENCRYPTION_KEY before saving credentials");
    try {
      byte[] nonce=new byte[12];new SecureRandom().nextBytes(nonce);
      Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,nonce));
      c.updateAAD(context.getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(nonce)+"."+Base64.getEncoder().encodeToString(c.doFinal(token.getBytes(StandardCharsets.UTF_8)));
    } catch(Exception e) { throw new IllegalStateException("Could not encrypt integration credential"); }
  }
  public String decrypt(String value,String context) {
    try {
      String[] parts=value.split("\\.");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
      c.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,Base64.getDecoder().decode(parts[0])));
      c.updateAAD(context.getBytes(StandardCharsets.UTF_8));
      return new String(c.doFinal(Base64.getDecoder().decode(parts[1])),StandardCharsets.UTF_8);
    } catch(Exception e) { throw new IllegalStateException("Integration credential cannot be decrypted; reconnect"); }
  }
}
