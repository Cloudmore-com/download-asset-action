const core = require("@actions/core");
const { Octokit } = require("@octokit/rest");
const { save } = require("save-file");
const { createActionAuth } = require("@octokit/auth-action");
const path = require("path");

function requestLogger(httpModule) {
  var original = httpModule.request;
  httpModule.request = function (options, callback) {
    if (options.host.includes("objects.githubusercontent")) {
      delete options.headers["authorization"];
    }

    return original(options, callback);
  };
}

requestLogger(require("http"));
requestLogger(require("https"));

async function run() {
  try {
    // Authentication
    const octokit = new Octokit({
      authStrategy: createActionAuth,
    });
    // Inputs
    const [owner, repo] = core.getInput('repository').split("/");
    const excludes = core.getInput('excludes').trim().split(",");
    const tag = core.getInput('tag');
    const assetName = core.getInput('asset');
    const target = core.getInput('target');

    // Get release
    let releases = await octokit.repos.listReleases({
      owner: owner,
      repo: repo,
    });
    releases = releases.data;
    if (excludes) {
      if (excludes.includes("prerelease"))
        releases = releases.filter((rel) => rel.prerelease != true);
      if (excludes.includes("draft"))
        releases = releases.filter((rel) => rel.draft != true);
    }
    if (tag) releases = releases.filter((rel) => rel.tag_name.includes(tag));
    if (releases.length === 0) throw new Error("No matching releases");

    // Get asset
    let assets = releases[0].assets;
    assets = assets.filter((ass) => ass.name.includes(assetName));

    if (assets.length === 0) throw new Error("No matching assets");

    asset = await octokit.repos.getReleaseAsset({
      headers: {
        Accept: "application/octet-stream",
        authorization: null,
      },
      owner: owner,
      repo: repo,
      asset_id: assets[0].id,
    });
    await save(asset.data, path.join(target, assets[0].name));

    core.setOutput("name", assets[0].name);
  } catch (error) {
    console.log("error");
    core.setFailed(error.message);
  }
}

run();
