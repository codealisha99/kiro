ALTER TABLE provider_connections DROP CONSTRAINT provider_connections_provider_check;
ALTER TABLE provider_connections ADD CONSTRAINT provider_connections_provider_check
  CHECK(provider IN ('github','slack','linear','hubspot','xero','bamboohr','googleanalytics','googledrive'));
