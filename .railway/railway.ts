import { defineRailway, github, postgres, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const kiro = github("codealisha99/kiro", { branch: "main", checkSuites: true });

  const Postgres = postgres("Postgres", { region: "sfo" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const Redis = redis("Redis", { region: "sfo" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  Redis.networking = { privateNetworkEndpoint: "redis" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 5000 });
  const apiVolume = volume("api-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 5000 });
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 5000 });
  const api = service("api", {
    source: kiro,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/api-java/Dockerfile", watchPatterns: ["apps/api-java/**"] },
    healthcheck: "/actuator/health",
    healthcheckTimeout: 180,
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
    volumeMounts: { "/data": apiVolume },
  });
  const ai = service("ai", {
    source: kiro,
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "apps/ai/Dockerfile", watchPatterns: ["apps/ai/**"] },
    healthcheck: "/admin/health",
    healthcheckTimeout: 60,
    replicas: { "sfo": 1 },
    deploy: { restartPolicyMaxRetries: 5 },
  });

  return project("kiro", {
    variables: { managed: false },
    resources: [api, Postgres, Redis, ai, postgresVolume, apiVolume, redisVolume],
  });
});
