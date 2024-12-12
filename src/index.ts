/*
 * index.ts
 *
 * This source file will implement [TODO – add in description]
 */
// TODO: add in import statements
/*
 * function main();
 *
 * This is the mainline code for our project. This code will
 * perform the following work:
 * TODO – add in description
 */
import { Client } from "pg";
import express, { Request, Response, NextFunction } from "express";
import * as fs from "fs";
import { Config } from "./config-interface";

interface RestConfig {
  port: number;
  endpoints: Endpoint[];
}

interface ParameterField {
  name: string;
}

interface Endpoint {
  name: string;
  path: string;
  method: string;
  sql: string;
  parameterss: string[];
}

//read a file synchronously - used to get config.json
function readFile(file_path: string): string | void {
  try {
    const data = fs.readFileSync(file_path, "utf8");
    return data;
  } catch (err) {
    console.error(err);
    return;
  }
}

// Function to read data from the db
async function queryData(sql: string, dbClient: Client) {
  const result = await dbClient.query(sql);
  console.log(result.rows.length);
  return result.rows;
}

async function main() {
  //where the config.json structure will live
  let config: Config;
  console.log("Loading Configurations...");
  //read the config.json file
  const config_str: string | void = readFile("config.json");
  //if it's not string (it's a void) OR it's empty, then we can't go on
  if (typeof config_str !== "string" || config_str.length === 0) {
    console.error(
      "Failed to parse config.json. (empty file or null returned)  Application Aborted."
    );
    return;
  } else {
    //attempting to JSON parse this file's contents should load it into memory as the Config interface.
    //So, if parsing fails we can't go on
    try {
      //parsing succeeded, we're in business
      config = JSON.parse(config_str) as Config;
      console.log("Configurations Successfully Loaded.");
    } catch (err) {
      //parsing failed. we go bye bye... :(
      console.error(
        "Failed to parse config.json. (failed to parse as a json object)  Application Aborted."
      );
      return;
    }
  }
  //where the config.json structure will live
  let restconfig: RestConfig;
  console.log("Loading Configurations...");
  //read the config.json file
  const rconfig_str: string | void = readFile("rest_config.json");
  //if it's not string (it's a void) OR it's empty, then we can't go on
  if (typeof rconfig_str !== "string" || rconfig_str.length === 0) {
    console.error(
      "Failed to parse rest_config.json. (empty file or null returned)  Application Aborted."
    );
    return;
  } else {
    //attempting to JSON parse this file's contents should load it into memory as the Config interface.
    //So, if parsing fails we can't go on
    try {
      //parsing succeeded, we're in business
      restconfig = JSON.parse(rconfig_str) as RestConfig;
      console.log("Rest Configuration Successfully Loaded.");
    } catch (err) {
      //parsing failed. we go bye bye... :(
      console.error(
        "Failed to parse rest_config.json. (failed to parse as a json object)  Application Aborted."
      );
      return;
    }
  }
  //now configs are loaded, use it....
  console.log("Connecting to Database");
  // Initialize PostgreSQL client
  const dbClient: Client = new Client(config.database.connection);
  //connect client
  try {
    await dbClient.connect();
    console.log("Connected to PostgreSQL Database");
  } catch (err) {
    console.error("Error connecting to PostgreSQL. Application Aborted:", err);
    return;
  }
  //get port from rest_config
  const port: number = restconfig["port"];
  // create an express application
  const app: express.Application = express();
  // middleware for our application
  app.use((req: Request, res: Response, next: NextFunction) => {
    // our custom processing on each request to our application - this outputs the request to the console
    console.log(`${req.method} ${req.path}`);
    // continue default processing of the request
    next();
  });
  // register a route handler for a HTTP GET request
  app.get("/", (req: Request, res: Response) => {
    res.send("Welcome to our first TypeScript REST API App!");
  });
  // create a router for our API
  const apiRouter = express.Router();
  // middleware for our API router
  apiRouter.use((req: Request, res: Response, next: NextFunction) => {
    // our custom processing on each request to our API - currently just console logging
    console.log("API router specific middleware!");
    // continue default processing
    next();
  });
  //get interval from mqtt config
  const interval = config.mqtt.connection.polling_interval;
  //get endpoints from rest_config
  restconfig.endpoints.forEach((endpoint: Endpoint) => {
    // register a route handler for a HTTP GET request
    apiRouter.get(endpoint.path, async (req: Request, res: Response) => {
      // our custom processing on each request to the endpoint
      let sql = endpoint.sql;
      //get parameters
      const params = req.query;
      console.log(`In ${endpoint.name} API handler with parameters: ${params}`);
      //replace parameters
      endpoint.parameterss.forEach((param: string) => {
        const value = params[param];
        if (isNaN(Number(value))) {
          res.status(500);
          res.send(`Parameter ${param} is not a number.  Please provide a number.`);
        } else if (Number(value) <= 0) {
          res.status(500);
          res.send(`Parameter ${param} must be greater than 0.  Please provide a number greater than 0.`);
        } else {
          let adj_value: number;
          //convert elapsed to seconds based on interval (since PostGres server does not have NTP)
          if (param === "elapsed") {
            adj_value = (Number(value) * 1000) / interval;
          } else {
            adj_value = Number(value);
          }
          sql = sql.replace(`{${param}}`, adj_value.toString());
        }
      });
      // send data back to the client as an html table
      console.log(sql);
      const data = await queryData(sql, dbClient);
      res.json(data);
    });
  });

  // register our API router - this will be mounted at /api - i.e. http://localhost:4000/api
  app.use(apiRouter);
  // start our application
  app.listen(port, () => {
    console.log(`Welcome to Team 2's REST API (on port ${port})`);
  });
}
main(); // execute main function
