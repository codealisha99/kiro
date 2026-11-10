package com.kiro.api.home;

import com.kiro.api.security.AuthenticatedPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/home")
public class HomeController {
  private final HomeService home;

  public HomeController(HomeService home) { this.home = home; }

  @GetMapping public Object home(@AuthenticationPrincipal AuthenticatedPrincipal u) { return home.home(u); }
}
