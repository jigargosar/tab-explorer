console.log("Loading background.js");

const rt = chrome.runtime;

rt.getPackageDirectoryEntry(d => {
  d.getMetadata(
    s => {
      // debugger;
    },
    e => {
      // debugger;
    }
  );
});

const mg = chrome.management;
