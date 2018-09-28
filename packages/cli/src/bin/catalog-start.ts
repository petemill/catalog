#!/usr/bin/env node
import "babel-polyfill";
process.env.NODE_ENV = "development";

import * as args from "args";
import * as detect from "detect-port";
import { exists } from "sander";
import * as openBrowser from "react-dev-utils/openBrowser";

import { infoMessageDimmed, errorMessage } from "../utils/format";

import loadWebpackConfig from "../actions/loadWebpackConfig";
import loadConfigFile from "../actions/loadConfigFile";
import detectFramework, { Framework } from "../actions/detectFramework";
import loadPaths from "../actions/loadPaths";

import setupCatalog from "../actions/setupCatalog";
import runDevServer from "../actions/runDevServer";

// Parse env

args
  .option(
    "port",
    "Port on which the Catalog server runs",
    4000,
    (port: string) => parseInt(port, 10)
  )
  .option("https", "Use https", false)
  .option("host", "Host", "localhost")
  .option("proxy", "Proxy")
  .option("babelrc", "Use local .babelrc file (defaults to true)");

const cliOptions = args.parse(process.argv, {
  value: "[source directory]",
  mri: {
    boolean: ["babelrc"]
  }
});

const getFrameworkName = (framework: Framework): string => {
  switch (framework) {
    case "CREATE_REACT_APP":
      return "Create React App";
    case "NEXT":
      return "next.js (support is experimental)";
    case "UNKNOWN":
    default:
      return "";
  }
};

export const run = async (
  catalogSrcDir: string = "catalog",
  options: {
    port: number;
    https: boolean;
    host: string;
    proxy: void | string;
    babelrc: void | boolean;
  }
) => {
  const framework = await detectFramework();

  const configFile = await loadConfigFile();

  const paths = await loadPaths(catalogSrcDir, "", framework, "/");

  const port = await detect(options.port);

  const url =
    (options.https ? "https" : "http") +
    "://" +
    options.host +
    ":" +
    port +
    "/";

  const babelrcExists: boolean = await exists(paths.babelrc);

  const useBabelrc =
    options.babelrc !== undefined
      ? options.babelrc
      : configFile && configFile.useBabelrc !== undefined
        ? configFile.useBabelrc
        : babelrcExists;

  const webpackOptions = { paths, dev: true, framework, url, useBabelrc };

  let webpackConfig = await loadWebpackConfig(webpackOptions);

  if (configFile) {
    if (typeof configFile.webpack === "function") {
      webpackConfig = configFile.webpack(webpackConfig, webpackOptions);
    }
  }

  await setupCatalog(paths);

  console.log(`
  Starting Catalog …
`);
  if (configFile) {
    console.log(
      infoMessageDimmed("  Using configuration file catalog.config.js")
    );
  }
  if (framework !== "UNKNOWN") {
    console.log(infoMessageDimmed("  Detected " + getFrameworkName(framework)));
  }
  if (useBabelrc) {
    console.log(infoMessageDimmed("  Using custom .babelrc"));
  }

  const { devServer } = await runDevServer(
    webpackConfig,
    options.host,
    port,
    options.https,
    paths,
    framework,
    options.proxy
  );

  openBrowser(url);

  return devServer;
};

run(args.sub[0], cliOptions).catch(err => {
  console.error(errorMessage("Could not start Catalog\n\n" + err.stack + "\n"));
  process.exit(1);
});
