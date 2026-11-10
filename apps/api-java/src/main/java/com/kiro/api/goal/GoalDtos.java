package com.kiro.api.goal;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class GoalDtos {
  private GoalDtos() {}

  /** Create and update body. {@code status} and {@code expectedVersion} apply to update only. */
  public record GoalInput(
      @NotNull @Pattern(regexp = "COMPANY|DEPARTMENT|TEAM|PERSON") String scope,
      @Size(max = 100) String departmentId,
      @Size(max = 100) String teamId,
      @NotBlank @Size(max = 100) String ownerId,
      @Size(max = 100) String parentId,
      @NotBlank @Size(max = 200) String title,
      @Size(max = 2000) String description,
      @NotNull @Pattern(regexp = "METRIC|TASKS|CHILDREN") String measure,
      @Size(max = 40) String unit,
      @Digits(integer = 12, fraction = 2) BigDecimal startValue,
      @Digits(integer = 12, fraction = 2) BigDecimal targetValue,
      @Digits(integer = 12, fraction = 2) BigDecimal currentValue,
      @NotNull LocalDate startDate,
      @NotNull LocalDate dueDate,
      @Pattern(regexp = "ACTIVE|ACHIEVED|CANCELLED") String status,
      @Min(1) Integer expectedVersion) {}

  public record CheckinInput(
      @Digits(integer = 12, fraction = 2) BigDecimal value,
      @NotBlank @Size(max = 1000) String note) {}

  public record TaskLinkInput(@NotBlank @Size(max = 100) String taskId, boolean unlink) {}
}
