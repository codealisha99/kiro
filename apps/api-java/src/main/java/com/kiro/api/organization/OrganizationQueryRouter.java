package com.kiro.api.organization;

import com.kiro.api.security.AuthenticatedPrincipal;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/** Routes clear operational questions to permission-scoped, structured work data. */
@Service
public class OrganizationQueryRouter {
  private static final Pattern OPERATIONAL = Pattern.compile(
      "\\b(task|tasks|work item|work items|project|projects|workload|workloads|blocked|overdue|" +
      "deadline|deadlines|remaining effort|remaining hours|team progress|department progress|" +
      "company progress|organization progress|org progress|work in progress|on track|capacity|risks?)\\b",
      Pattern.CASE_INSENSITIVE);
  private static final List<String> BROAD_VIEWS = List.of("CEO", "VP", "DIRECTOR", "MANAGER", "EMPLOYEE");
  private final OrganizationService organization;
  private final OrganizationDashboard dashboard;

  public OrganizationQueryRouter(OrganizationService organization, OrganizationDashboard dashboard) {
    this.organization = organization;
    this.dashboard = dashboard;
  }

  public Optional<Map<String, Object>> route(AuthenticatedPrincipal user, String question) {
    if (question == null || !OPERATIONAL.matcher(question).find()) return Optional.empty();
    String normalized = question.toLowerCase(Locale.ROOT);
    if (normalized.matches(".*\\b(policy|policies|guideline|guidelines|procedure|procedures|handbook|contract|document)\\b.*")
        && !normalized.matches(".*\\b(blocked|overdue|deadline|deadlines|workload|remaining hours)\\b.*")) {
      return Optional.empty();
    }
    var available = organization.views(user);
    String view = chooseView(question, available);
    Map<String, Object> result = dashboard.dashboard(user, view);
    result.put("route", "structured_work");
    result.put("question", question);
    result.put("scope", view);
    return Optional.of(result);
  }

  private String chooseView(String question, List<String> available) {
    String normalized = question.toLowerCase(Locale.ROOT);
    if (normalized.matches(".*\\b(my|mine|i have|assigned to me)\\b.*")) return "EMPLOYEE";
    List<String> preference;
    if (normalized.contains("department")) preference = List.of("DIRECTOR", "VP", "CEO", "MANAGER", "EMPLOYEE");
    else if (normalized.contains("team")) preference = List.of("MANAGER", "DIRECTOR", "VP", "CEO", "EMPLOYEE");
    else preference = BROAD_VIEWS;
    return preference.stream().filter(available::contains).findFirst().orElse("EMPLOYEE");
  }
}
