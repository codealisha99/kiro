package com.kiro.api.work;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class WorkDtos {
  private WorkDtos() {}
  public record ProjectInput(@NotBlank @Size(max=200) String name) {}
  public record InsightTriageInput(
      @NotNull @Pattern(regexp="OPEN|ACKNOWLEDGED|DISMISSED") String status,
      @Size(max=1000) String reason,
      @NotNull @Min(1) Integer expectedVersion) {}
  public record TaskInput(
      @NotBlank @Size(max=200) String title,
      @NotNull @Pattern(regexp="TODO|IN_PROGRESS|BLOCKED|DONE") String status,
      @Size(max=100) String assigneeId,
      @DecimalMin("0") @DecimalMax("100000") BigDecimal remainingHours,
      LocalDate dueDate,
      @Min(1) Integer expectedVersion) {}
  public record GrantInput(@NotBlank @Size(max=100) String userId,
      @NotNull @Pattern(regexp="READ|WRITE") String permission) {}
  public record DependencyInput(@NotBlank @Size(max=100) String dependsOnId,
      @NotBlank @Size(max=1000) String rationale) {}
  public record ScenarioInput(@NotBlank @Size(max=200) String name,
      @NotNull LocalDate periodStart, @NotNull LocalDate periodEnd,
      @NotNull @DecimalMin("0.01") @DecimalMax("100000") BigDecimal availableHours,
      @NotNull @DecimalMin("0") @DecimalMax("100000") BigDecimal proposedHours,
      @NotBlank @Size(max=1000) String rationale) {}
  public record ScenarioCompareInput(@NotNull @Size(min=2,max=4) List<@NotBlank @Size(max=100) String> ids) {}
  public record ScenarioApprovalInput(@NotNull @Pattern(regexp="APPROVED|REJECTED") String status,
      @Size(max=1000) String reason,@NotNull @Min(1) Integer expectedVersion) {}
  public record ScenarioOutcomeInput(@NotNull @Pattern(regexp="IN_PROGRESS|DELIVERED|NOT_DELIVERED|CANCELLED") String status,
      @DecimalMin("0") @DecimalMax("100000") BigDecimal actualHours,
      @NotBlank @Size(max=1000) String note,@NotNull @Min(0) Integer expectedVersion) {}
}
