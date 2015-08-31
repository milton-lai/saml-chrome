/*
 * GNU General Public License, version 2 (GPL-2.0)
 *   http://opensource.org/licenses/GPL-2.0
 *
 *   Console/Logging referenced from the Chrome-FirePHP extension
 *
 *   Author: Milton Lai
 */

function Console() {}

Console.Type = {
    LOG: "log",
    DEBUG: "debug",
    INFO: "info",
    WARN: "warn",
    ERROR: "error",
    GROUP: "group",
    GROUP_COLLAPSED: "groupCollapsed",
    GROUP_END: "groupEnd"
};

Console.addMessage = function(type, format, args) {
    chrome.extension.sendRequest({
        command: "sendToConsole",
        tabId: chrome.devtools.tabId,
        args: escape(JSON.stringify(Array.prototype.slice.call(arguments, 0)))
    });
};

// Generate Console output methods, i.e. Console.log(), Console.debug() etc.
(function() {
    var console_types = Object.getOwnPropertyNames(Console.Type);
    for (var type = 0; type < console_types.length; ++type) {
        var method_name = Console.Type[console_types[type]];
        Console[method_name] = Console.addMessage.bind(Console, method_name);
    }
})();

function ChromeSAML() {};

ChromeSAML.handleSAMLHeaders = function(har_entry) {
    var response_headers = har_entry.response.headers;
    var request_headers = har_entry.request.headers;
    var request_method = har_entry.request.method;
    var request_url = har_entry.request.url;
    var saml_request_string = "SAMLRequest=";
    var saml_response_string = "SAMLResponse=";
    var relay_state_string = "RelayState=";

    var index_of_saml_request_string = request_url.indexOf(saml_request_string);
    if (index_of_saml_request_string > -1) {
        Console.log("SAML Request Method: " + request_method);
        Console.log("SAML Request URL: " + request_url);
        var index_of_relay_state_string = request_url.indexOf(relay_state_string);

        //assumes that the GET request is http(s)://host/sso/idp?SAMLRequest=xxxxx&RelayState=yyyy
        var saml_message = request_url.substr(index_of_saml_request_string + saml_request_string.length, index_of_relay_state_string - 1 - (index_of_saml_request_string + saml_request_string.length));
        //requires inflating
        var decoded_saml_message = RawDeflate.inflate(window.atob(unescape(saml_message)));
        Console.log("SAML Request Data: " + decoded_saml_message);
    }

    var har_post_data = null;
    if (har_entry.request != null && har_entry.request.postData != null) {
        har_post_data = har_entry.request.postData.text;
    };

    if (har_post_data != null) {
        if (har_post_data.slice(0, saml_request_string.length) == saml_request_string) {
            var decoded_saml_message = getDecodedSamlMessageFromPostData("Request", request_method, request_url, har_post_data, saml_request_string);
            Console.log("SAML Request Data: " + decoded_saml_message);

        } else if (har_post_data.slice(0, saml_response_string.length) == saml_response_string) {
            var decoded_saml_message = getDecodedSamlMessageFromPostData("Response", request_method, request_url, har_post_data, saml_response_string);

            Console.log("SAML Response Data: " + decoded_saml_message);
        }
    }
};

function getDecodedSamlMessageFromPostData(request_response_string, request_method, request_url, har_post_data, saml_string) {
    Console.log("SAML " + request_response_string + " Method: " + request_method);
    Console.log("SAML " + request_response_string + " URL: " + request_url);
    var saml_message = har_post_data.substr(saml_string.length, har_post_data.length - saml_string.length);
    //using the window.atob base64 decoding method as it seems to work pretty well
    var decoded_saml_message = window.atob(unescape(saml_message));
    return decoded_saml_message;
};


chrome.devtools.network.addRequestHeaders({
    "X-ChromeSAML-Version": "0.9"
});

chrome.devtools.network.getHAR(function(result) {
    var entries = result.entries;
    if (!entries.length) {
        Console.warn("SAML for Chrome suggests that you reload the page to track" +
            " SAML for Chrome messages for all the requests");
    }
    for (var i = 0; i < entries.length; ++i)
        ChromeSAML.handleSAMLHeaders(entries[i]);

    chrome.devtools.network.onRequestFinished.addListener(
        ChromeSAML.handleSAMLHeaders.bind(ChromeSAML));
});