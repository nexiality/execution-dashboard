'use strict';

/**
 *
 * Add an URL parser to JQuery that returns an object.
 * This function is meant to be used with an URL like the window.location.
 *
 * Use: $.parseParams('http://mysite.com/?var=string') or $.parseParams() to parse the window.location
 * Simple variable:  ?var=abc                        returns {var: "abc"}
 * Simple object:    ?var.length=2&var.scope=123     returns {var: {length: "2", scope: "123"}}
 * Simple array:     ?var[]=0&var[]=9                returns {var: ["0", "9"]}
 * Array with index: ?var[0]=0&var[1]=9              returns {var: ["0", "9"]}
 * Nested objects:   ?my.var.is.here=5               returns {my: {var: {is: {here: "5"}}}}
 * All together:     ?var=a&my.var[]=b&my.cookie=no  returns {var: "a", my: {var: ["b"], cookie: "no"}}
 *
 * You just cant have an object in an array,
 *  ?var[1].test=abc DOES NOT WORK
 */
(function ($) {
    var re     = /([^&=]+)=?([^&]*)/g;
    var decode = function (str) { return decodeURIComponent(str.replace(/\+/g, ' ')); };

    $.parseParams = function (query) {
        // recursive function to construct the result object
        function createElement(params, key, value) {
            if (!params) { params = {}; }

            key = key + '';

            // if the key is a property
            if (key.indexOf('.') !== -1) {
                // extract the first part with the name of the object
                var list = key.split('.');

                // create the object if it doesnt exist
                var objectName = list[0];
                if (!params[objectName]) { params[objectName] = {}; }

                // the rest of the key
                var new_key = key.split(/\.(.+)?/)[1];

                // if the key is not empty, create it in the object
                if (new_key !== '') {
                    createElement(params[objectName], new_key, value);
                } else {
                    console.warn('parseParams :: empty property in key "' + key + '"');
                }
            } else {
                // if the key is an array
                if (key.indexOf('[') !== -1 && key.indexOf(']') !== -1) {
                    // extract the array name
                    var arrayParam = key.split('[');
                    key            = arrayParam[0];

                    // extract the index of the array
                    var index = arrayParam[1].split(']')[0];

                    // if index is empty, just push the value at the end of the array
                    if (index === '') {
                        if (!params[key] || !$.isArray(params[key])) { params[key] = []; }
                        params[key].push(value);
                    } else {
                        // add the value at the index (must be an integer)
                        if (!params[key] || !$.isArray(params[key])) { params[key] = []; }
                        params[key][parseInt(index)] = value;
                    }
                } else {
                    // just normal key
                    params[key] = value;
                }
            }
        }

        // be sure the query is a string
        if (!query || query === undefined || query === '') { query = window.location + ''; }

        // remove # from end of query
        if (query.indexOf('#') !== -1) { query = query.substr(0, query.indexOf('#')); }

        // remove ? at the begining of the query
        query = query.substr(query.indexOf('?') + 1, query.length);

        // empty parameters
        if (query === '') { return {}; }

        // execute a createElement on every key and value
        var params = {};
        var matches;
        while (matches = re.exec(query)) {
            createElement(params, decode(decode(matches[1])), decode(decode(matches[2])));
        }
        return params;
    };
})(jQuery);
