package com.kiro.api.job;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;

class IngestJobServiceTest {
  @Test
  void redisOutageBacksOffInsteadOfSpinning() throws Exception {
    var redis = mock(StringRedisTemplate.class);
    var attempts = new AtomicInteger();
    var started = new CountDownLatch(4);
    when(redis.opsForList()).thenAnswer(inv -> {
      attempts.incrementAndGet();
      started.countDown();
      throw new IllegalStateException("Redis unavailable");
    });
    var service = new IngestJobService(redis, null, null);
    try {
      service.start();
      assertTrue(started.await(5, TimeUnit.SECONDS));
      Thread.sleep(100);
      assertEquals(4, attempts.get());
    } finally {
      service.stop();
    }
  }
}
