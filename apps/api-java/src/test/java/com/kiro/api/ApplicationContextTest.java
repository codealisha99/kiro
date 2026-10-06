package com.kiro.api;

import static org.junit.jupiter.api.Assertions.*;

import com.kiro.api.ingestion.ChunkerService;
import com.kiro.api.ingestion.ParserService;
import com.kiro.api.retrieval.RetrievalService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

/** The whole application context must wire up (controllers, security, jobs, JPA). */
@SpringBootTest
@ActiveProfiles("test")
class ApplicationContextTest {

  @Autowired ApplicationContext ctx;

  @Test
  void contextLoads() {
    assertNotNull(ctx);
  }

  @Test
  void keyBeansPresent() {
    assertTrue(ctx.containsBean("authController"));
    assertTrue(ctx.containsBean("documentController"));
    assertTrue(ctx.containsBean("brainController"));
    assertTrue(ctx.containsBean("adminController"));
    assertTrue(ctx.containsBean("evaluationController"));
    assertTrue(ctx.containsBean("securityConfig"));
  }

  @Test
  void statelessServicesResolve() {
    assertNotNull(ctx.getBean(ChunkerService.class));
    assertNotNull(ctx.getBean(ParserService.class));
    assertNotNull(ctx.getBean(RetrievalService.class));
  }
}
