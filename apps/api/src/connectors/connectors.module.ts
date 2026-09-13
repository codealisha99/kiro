import { Global, Module } from "@nestjs/common";
import { GoogleDriveConnector } from "./google-drive.connector";
import { SlackConnector } from "./slack.connector";
import { CrmConnector } from "./crm.connector";
import { ConnectorsService } from "./connectors.service";

@Global()
@Module({
  providers: [GoogleDriveConnector, SlackConnector, CrmConnector, ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
