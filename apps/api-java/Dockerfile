# ---- build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q dependency:go-offline -DskipTests
COPY src ./src
RUN mvn -q package -DskipTests

# ---- runtime stage ----
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /build/target/kiro-api-*.jar /app/app.jar
EXPOSE 3001
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
