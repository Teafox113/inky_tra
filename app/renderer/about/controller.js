const electron = require("electron");
const ipc = electron.ipcRenderer;
const forkInfo = require('../../version.json');
const $ = window.jQuery = require('../jquery-2.2.3.min.js');


ipc.on("set-about-data", (event, data) => {
    $("#version-inky").text("繁中擴充版："+forkInfo.version);
    $("#modified-date").text("修改日期："+forkInfo.modifiedDate);
    $("#version-ink").text("ink version: "+data.inkVersion);
    $("#version-inkjs").text("inkjs version: "+data.inkjsVersion);
});

function updateTheme(event, newTheme) {
    let themes = ["dark", "contrast", "focus"];
    themes = themes.filter(e => e !== newTheme);
    if (newTheme && newTheme.toLowerCase() !== 'main')
    {
        $(".body").addClass(newTheme);
    }
    for (const theme of themes) {
        $(".body").removeClass(theme);
    }
}

updateTheme(null, window.localStorage.getItem("theme"));
ipc.on("change-theme", updateTheme);
