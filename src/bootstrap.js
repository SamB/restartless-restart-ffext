/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2010 Erik Vold
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Contributor(s):
 *   Erik Vold <erikvvold@gmail.com> (Original Author)
 *   Greg Parris <greg.parris@gmail.com>
 *   Nils Maier <maierman@web.de>
 *   Szabolcs Hubai <szab.hu@gmail.com>
 *
 * ***** END LICENSE BLOCK ***** */

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const keysetID = "restartless-restart-keyset";
const keyID = "RR:Restart";
const fileMenuitemID = "menu_FileRestartItem";
var XUL_APP = {name: Services.appinfo.name};

switch(Services.appinfo.name) {
case "Thunderbird":
  XUL_APP.winType = "mail:3pane";
  XUL_APP.baseKeyset = "mailKeys";
  break;
case "Fennec": break;
default: //"Firefox", "SeaMonkey"
  XUL_APP.winType = "navigator:browser";
  XUL_APP.baseKeyset = "mainKeyset";
}

const PREF_BRANCH = Services.prefs.getBranch("extensions.restartless-restart.");
// pref defaults
const PREFS = {
  get key() _("restart.ak", getPref("locale")),
  modifiers: "accel,alt",
  locale: undefined,
  "disable_fastload": false,
  toolbar: null,
  "toolbar.before": null
};

var prefChgHandlers = [];
let PREF_OBSERVER = {
  observe: function(aSubject, aTopic, aData) {
    if ("nsPref:changed" != aTopic || !(aData in PREFS)) return;
    prefChgHandlers.forEach(function(func) func && func(aData));
  }
}

let logo = "";

(function(global) global.include = function include(src) (
    Services.scriptloader.loadSubScript(src, global)))(this);

function getPref(aName) {
  var pref = PREF_BRANCH;
  var type = pref.getPrefType(aName);

  // if the type is valid, then return the value
  switch(type) {
  case pref.PREF_STRING:
    return pref.getComplexValue(aName, Ci.nsISupportsString).data;
  case pref.PREF_BOOL:
    return pref.getBoolPref(aName);
  }

  // return default
  return PREFS[aName];
}

function setPref(aKey, aVal) {
  aVal = ("wrapper-restartlessrestart-toolbarbutton" == aVal) ? "" : aVal;
  switch (typeof(aVal)) {
    case "string":
      var ss = Cc["@mozilla.org/supports-string;1"]
          .createInstance(Ci.nsISupportsString);
      ss.data = aVal;
      PREF_BRANCH.setComplexValue(aKey, Ci.nsISupportsString, ss);
      break;
  }
}

function addMenuItem(win) {
  var $ = function(id) win.document.getElementById(id);

  function removeMI() {
    var menuitem = $(fileMenuitemID);
    menuitem && menuitem.parentNode.removeChild(menuitem);
  }
  removeMI();

  // add the new menuitem to File menu
  let (restartMI = win.document.createElementNS(NS_XUL, "menuitem")) {
    restartMI.setAttribute("id", fileMenuitemID);
    restartMI.setAttribute("class", "menuitem-iconic");
    restartMI.setAttribute("label", _("restart", getPref("locale")));
    restartMI.setAttribute("accesskey", "R");
    restartMI.setAttribute("key", keyID);
    restartMI.style.listStyleImage = "url('" + logo + "')";
    restartMI.addEventListener("command", restart, true);

    $("menu_FilePopup").insertBefore(restartMI, $("menu_FileQuitItem"));
  }

  unload(removeMI, win);
}

function restart() {
  let canceled = Cc["@mozilla.org/supports-PRBool;1"]
      .createInstance(Ci.nsISupportsPRBool);

  Services.obs.notifyObservers(canceled, "quit-application-requested", "restart");

  if (canceled.data) return false; // somebody canceled our quit request

  // disable fastload cache?
  if (getPref("disable_fastload")) Services.appinfo.invalidateCachesOnRestart();

  // restart
  Cc['@mozilla.org/toolkit/app-startup;1'].getService(Ci.nsIAppStartup)
      .quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);

  return true;
}

function main(win) {
  let doc = win.document;
  function $(id) doc.getElementById(id);
  function xul(type) doc.createElementNS(NS_XUL, type);

  let rrKeyset = xul("keyset");
  rrKeyset.setAttribute("id", keysetID);

  // add hotkey
  let (restartKey = xul("key")) {
    restartKey.setAttribute("id", keyID);
    restartKey.setAttribute("key", getPref("key"));
    restartKey.setAttribute("modifiers", getPref("modifiers"));
    restartKey.setAttribute("oncommand", "void(0);");
    restartKey.addEventListener("command", restart, true);
    $(XUL_APP.baseKeyset).parentNode.appendChild(rrKeyset).appendChild(restartKey);
  }

  // add menu bar item to File menu
  addMenuItem(win);

  // add app menu item to Firefox button for Windows 7
  let appMenu = $("appmenuPrimaryPane"), restartAMI;
  if (appMenu) {
    restartAMI = $(fileMenuitemID).cloneNode(false);
    restartAMI.setAttribute("id", "appmenu_RestartItem");
    restartAMI.setAttribute("class", "menuitem-iconic menuitem-iconic-tooltip");
    restartAMI.style.listStyleImage = "url('" + logo + "')";
    restartAMI.addEventListener("command", restart, true);
    appMenu.insertBefore(restartAMI, $("appmenu-quit"));
  }

  // add toolbar button
  let rrTBB = xul("toolbarbutton");
  rrTBB.setAttribute("id", "restartlessrestart-toolbarbutton");
  rrTBB.setAttribute("type", "button");
  rrTBB.setAttribute("image", addon.getResourceURI("icon16.png").spec);
  rrTBB.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
  rrTBB.setAttribute("label", _("restart", getPref("locale")));
  rrTBB.addEventListener("command", restart, true);
  let tbID = getPref("toolbar");
  ($("navigator-toolbox") || $("mail-toolbox")).palette.appendChild(rrTBB);
  if (tbID) {
    var tb = $(tbID);
    if (tb) {
      let b4ID = getPref("toolbar.before");
      let b4 = $(b4ID);
      if (!b4) { // fallback for issue 34
        let currentset = tb.getAttribute("currentset").split(",");
        let i = currentset.indexOf("restartlessrestart-toolbarbutton") + 1;
        if (i > 0) {
          let len = currentset.length;
          for (; i < len; i++) {
            b4 = $(currentset[i]);
            if (b4) break;
          }
        }
      }
      tb.insertItem("restartlessrestart-toolbarbutton", b4, null, false);
    }
  }

  function saveTBNodeInfo(aEvt) {
    setPref("toolbar", rrTBB.parentNode.getAttribute("id") || "");
    setPref("toolbar.before", (rrTBB.nextSibling || "")
        && rrTBB.nextSibling.getAttribute("id").replace(/^wrapper-/i, ""));
  }
  win.addEventListener("aftercustomization", saveTBNodeInfo, false);

  var prefChgHanderIndex = prefChgHandlers.push(function(aData) {
    switch (aData) {
      case "locale":
        let label = _("restart", getPref("locale"));
        $(keyID).setAttribute("label", label);
        rrTBB.setAttribute("label", label);
        break;
      case "key":
      case "modifiers":
        $(keyID).setAttribute(aData, getPref(aData));
        break;
    }
    addMenuItem(win);
  }) - 1;

  unload(function() {
    rrKeyset.parentNode.removeChild(rrKeyset);
    appMenu && appMenu.removeChild(restartAMI);
    rrTBBB.parentNode.removeChild(rrTBB);
    rrTBB.parentNode.removeChild(rrTBB);
    win.removeEventListener("aftercustomization", saveTBNodeInfo);
    prefChgHandlers[prefChgHanderIndex] = null;
  }, win);
}

var addon = {
  getResourceURI: function(filePath) ({
    spec: __SCRIPT_URI_SPEC__ + "/../" + filePath
  })
}

function disable(id) {
  Cu.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(id, function(addon) {
    addon.userDisabled = true;
  });
}

function install(data) {
  if ("Fennec" == XUL_APP.name) disable(data.id);
}
function uninstall(){}
function startup(data, reason) {
  if ("Fennec" == XUL_APP.name) {
    if (ADDON_ENABLE == reason) restart();
    disable(data.id);
  }

  var prefs = PREF_BRANCH;
  include(addon.getResourceURI("includes/l10n.js").spec);
  include(addon.getResourceURI("includes/utils.js").spec);

  l10n(addon, "rr.properties");
  unload(l10n.unload);

  logo = addon.getResourceURI("images/refresh_16.png").spec;
  watchWindows(main, XUL_APP.winType);
  prefs = prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
  prefs.addObserver("", PREF_OBSERVER, false);
  unload(function() prefs.removeObserver("", PREF_OBSERVER));
};
function shutdown(data, reason) unload()
