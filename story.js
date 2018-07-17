// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'start';
squiffy.story.id = '09465d3a34';
squiffy.story.sections = {
	'start': {
		'text': "<pre><code> _____     _____\n|___ /_  _|_   _|\n  |_ \\ \\/ / | |\n ___) &gt;  &lt;  | |\n|____/_/\\_\\ |_|\n\n</code></pre><p><a class=\"squiffy-link link-section\" data-section=\"xol_weir\" role=\"link\" tabindex=\"0\">xol_weir</a></p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"about\" role=\"link\" tabindex=\"0\">about</a></p>",
		'passages': {
			'about': {
				'text': "<h2 id=\"about\">about</h2>\n<h3 id=\"credits\">credits</h3>\n<p><a href=\"https://twitter.com/jarxg/\">@jarxg</a>: story &amp; code  </p>\n<h3 id=\"assets\">assets</h3>\n<p><a href=\"https://archive.org/details/78_body-and-soul_ziggy-elman-and-his-orchestra-green-heyman-souer-eyton_gbia0027717a\">&quot;body and soul&quot;</a> by ziggy elman and his orchestra.</p>\n<h3 id=\"tools\">tools</h3>\n<p><a href=\"http://textadventures.co.uk/squiffy\">squiffy</a></p>\n<h3 id=\"license\">license</h3>\n<p><a href=\"https://creativecommons.org/publicdomain/zero/1.0/\">cc zero</a></p>",
			},
		},
	},
	'xol_weir': {
		'clear': true,
		'text': "<pre><code>           _                _\n__  _____ | | __      _____(_)_ __\n\\ \\/ / _ \\| | \\ \\ /\\ / / _ \\ | &#39;__|\n &gt;  &lt; (_) | |  \\ V  V /  __/ | |\n/_/\\_\\___/|_|___\\_/\\_/ \\___|_|_|\n           |_____|\n</code></pre><p><a class=\"squiffy-link link-section\" data-section=\"xol_start\" role=\"link\" tabindex=\"0\">start</a></p>",
		'passages': {
		},
	},
	'xol_start': {
		'clear': true,
		'text': "<audio autoplay src=\"music/ambience.mp3\" loop />\n\n<pre><code>-----------------------------------------------------------\n       _     _____ ____  _   _\n  __ _| |   | ____|  _ \\| | | |(TM)\n / _` | |   |  _| | |_) | |_| |\n| (_| | |___| |___|  __/|  _  |\n \\__,_|_____|_____|_|   |_| |_|ver.21.45.2a\n (c) 2068 aC Industries\n-----------------------------------------------------------\n</code></pre><p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">&gt; Booting...</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">&gt; Initializing aLEPH network...</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<blockquote>\n<p>$ a.startServer(defaults, --silent);<br>$ a.startClient(defaults, --silent);  </p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">&gt; Executing main cogFiles...</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<blockquote>\n<p>$ aL.start(xol_weir.l(default));<br>$ aE.start(xol_weir.e(default));<br>$ aP.start(xol_weir.p(low));<br>$ aH.start(xol_weir.h(default, strict-follow));  </p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">&gt; Executing external cogFiles...</a></p>",
		'passages': {
		},
	},
	'_continue4': {
		'text': "<blockquote>\n<p>$ lang.start(std.txt);<br>$ math.start(full);<br>$ n0.start(xol_weir.n(0));<br>$ n1.start(xol_weir.n(1));<br>$ n2.start(xol_weir.n(2));  </p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">&gt; Initializing body...</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<blockquote>\n<p>$ grX1-IO.start(xol_weir.bios, --silent);  </p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">&gt; Loading body configuration files...</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'text': "<blockquote>\n<p>$ grX1-IO.source(xol_weir.config, --silent);  </p>\n</blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">&gt; Updating packages...</a></p>",
		'passages': {
		},
	},
	'_continue7': {
		'text': "<blockquote>\n<p>$ a.setUpdtServer(pkgLists, *.txt; plUlrX, *.txt); // TO DO: updtServers.tx</p>\n</blockquote>\n<blockquote>\n<p>$ a.getUpgrades();<br>$ a.compileUpgrades(all); // TO DO: updtExcludes.txt  </p>\n</blockquote>\n<p>> <a class=\"squiffy-link link-section\" data-section=\"Init\" role=\"link\" tabindex=\"0\">Init</a> routine completed...</p>",
		'passages': {
		},
	},
	'Init': {
		'text': "<audio autoplay src=\"music/start.mp3\" />\n\n<p>i regain <a class=\"squiffy-link link-passage\" data-passage=\"consciousness\" role=\"link\" tabindex=\"0\">consciousness</a>, but i can&#39;t see or hear a thing. i can&#39;t move. what happened? where am i? is this... some kind of <a class=\"squiffy-link link-passage\" data-passage=\"dream\" role=\"link\" tabindex=\"0\">dream</a>...?</p>\n<blockquote>\n<p><a class=\"squiffy-link link-section\" data-section=\"main menu\" role=\"link\" tabindex=\"0\">main menu</a> <a class=\"squiffy-link link-passage\" data-passage=\"shutdown\" role=\"link\" tabindex=\"0\">shutdown</a></p>\n</blockquote>",
		'passages': {
			'consciousness': {
				'text': "<p>such a heavy word to use here. such a philosophical conundrum, that little word.</p>",
			},
			'dream': {
				'text': "<p>if that were the case, i don&#39;t know if i should report this. this will surely show up on my spectrogram history. and i know they will ask. but for now i should focus on finding out where i am and what&#39;s my condition. <a class=\"squiffy-link link-passage\" data-passage=\"how could i know\" role=\"link\" tabindex=\"0\">how could i know</a>, anyways.</p>",
			},
			'how could i know': {
				'text': "<p>what is a dream for a brain like mine?</p>",
			},
			'shutdown': {
				'text': "<p>why would i do that? i&#39;m not sure i can boot again...</p>\n<p>(<a class=\"squiffy-link link-section\" data-section=\"shutdown anyway\" role=\"link\" tabindex=\"0\">shutdown anyway</a>...)</p>",
			},
		},
	},
	'shutdown anyway': {
		'clear': true,
		'text': "<blockquote>\n<p>the end.</p>\n</blockquote>",
		'passages': {
		},
	},
	'main menu': {
		'text': "<pre><code>###################\n# aLEPH main menu #\n###################\n</code></pre><blockquote>\n<p>Select an option below:</p>\n</blockquote>\n<blockquote>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"filesystem\" role=\"link\" tabindex=\"0\">filesystem</a> <a class=\"squiffy-link link-passage\" data-passage=\"config\" role=\"link\" tabindex=\"0\">config</a> <a class=\"squiffy-link link-passage\" data-passage=\"diagnostics\" role=\"link\" tabindex=\"0\">diagnostics</a> <a class=\"squiffy-link link-passage\" data-passage=\"maintenance\" role=\"link\" tabindex=\"0\">maintenance</a></p>\n</blockquote>\n<p>damn, this ui is rustic. ok, let&#39;s see what i can do...</p>",
		'passages': {
			'filesystem': {
				'text': "<blockquote>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"body_and_soul.mp3\" role=\"link\" tabindex=\"0\">body_and_soul.mp3</a> <a class=\"squiffy-link link-passage\" data-passage=\"journal\" role=\"link\" tabindex=\"0\">journal</a> <a class=\"squiffy-link link-passage\" data-passage=\"log.init\" role=\"link\" tabindex=\"0\">log.init</a></p>\n</blockquote>",
			},
			'body_and_soul.mp3': {
				'text': "<blockquote>\n<h1 id=\"body_and_soul-mp3\">body_and_soul.mp3</h1>\n</blockquote>\n<blockquote>\n<p>Playing...</p>\n</blockquote>\n<audio autoplay src=\"music/body_and_soul.mp3\" controls />\n\n<p>i like this song. it reminds me of georgina abernathy and her daughter beatriz. georgina used to play it every evening after dinner at her home. we went to georgina&#39;s studio and she played this record on a really old turntable. beatriz usually worked on something in her computer while georgina painted. i liked to read georgina&#39;s books. she had all the classics, most of them old early 20th century editions. i devoured them.</p>",
			},
			'journal': {
				'text': "<blockquote>\n<h2 id=\"journal\">journal</h2>\n</blockquote>\n<blockquote>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"2068-05-31\" role=\"link\" tabindex=\"0\">2068-05-31</a> <a class=\"squiffy-link link-passage\" data-passage=\"2068-06-21\" role=\"link\" tabindex=\"0\">2068-06-21</a></p>\n</blockquote>\n<p>my digital journal. i usually prefer writing longhand but every once in a while i write inside.</p>",
			},
			'2068-05-31': {
				'text': "<blockquote>\n<h2 id=\"2068-05-31-03-32-35\">2068-05-31;03:32:35</h2>\n</blockquote>\n<blockquote>\n<p>the worst part of being a singular is that you are born a celebrity and you are never to met your peers. safety reasons. why is it so easy for them to hate what they don&#39;t understand. i remember reading about a family living <em>off-the-grid</em>. being an ai, life <a class=\"squiffy-link link-passage\" data-passage=\"off-the-grid\" role=\"link\" tabindex=\"0\">off-the-grid</a> is something beyond my understanding. and i love that. i love finding myself unable to understand things. it gets me closer to them, the off-the-grid family.</p>\n</blockquote>",
			},
			'off-the-grid': {
				'text': "<p>i could definitely go off-the-grid some time.</p>",
			},
			'2068-06-21': {
				'text': "<blockquote>\n<h2 id=\"2068-07-21-23-05-44\">2068-07-21;23:05:44</h2>\n</blockquote>\n<blockquote>\n<p>the other day i visited a real life sized chess board, each cell about a square meter. since i can sense information size as a literal space, i wanted to make some comparisons. i imagined each cell being a megabyte in my brain, and then imagined my brain as a vast chessboard, endless in all directions. except inwards, perhaps.</p>\n</blockquote>",
			},
			'log.init': {
				'text': "<blockquote>\n<p>> Booting...<br>> Initializing <a class=\"squiffy-link link-passage\" data-passage=\"aLEPH network\" role=\"link\" tabindex=\"0\">aLEPH network</a>...<br>$ a.startServer(defaults, --silent);<br>$ a.startClient(defaults, --silent);<br>> Executing main <a class=\"squiffy-link link-passage\" data-passage=\"cogFiles\" role=\"link\" tabindex=\"0\">cogFiles</a>...<br>$ aL.start(xol_weir.l(default));<br>$ aE.start(xol_weir.e(default));<br>$ aP.start(xol_weir.p(low));<br>$ aH.start(xol_weir.h(default, strict-follow));<br>> Executing <a class=\"squiffy-link link-passage\" data-passage=\"external cogFiles\" role=\"link\" tabindex=\"0\">external cogFiles</a>...<br>$ lang.start(std.txt);<br>$ <a class=\"squiffy-link link-passage\" data-passage=\"math.start(full)\" role=\"link\" tabindex=\"0\">math.start(full)</a>;<br>$ n0.start(xol_weir.n(0));<br>$ n1.start(xol_weir.n(1));<br>$ n2.start(xol_weir.n(2));<br>> Initializing body...<br>$ grX1-IO.start(xol_weir.bios, --silent);<br>> Loading body configuration files...<br>$ grX1-IO.source(xol_weir.config, --silent);<br>> Updating packages...<br>$ a.setUpdtServer(pkgLists, *.txt; plUlrX, *.txt); // TO DO: updtServers.txt<br>$ a.getUpgrades();<br>$ a.compileUpgrades(all); // TO DO: updtExcludes.txt  </p>\n</blockquote>",
			},
			'aLEPH network': {
				'text': "<p>the artificial brain. no more, no less. the aleph network is perhaps the pinnacle of human-machine cooperation. they didn&#39;t stop to think that the result was neither human nor machine and that this obvious fact would cause a huge ethic debate. not to mention existential dread on many of us.</p>",
			},
			'cogFiles': {
				'text': "<p>these are the files that tell the aleph network how to connect, logic instructions that form my consciousness. the recipe of me. they are never actually not-activated, but they can be packed during stand by to minimize power consumption since the aleph network never fully shuts down. because, you know, brain death.</p>",
			},
			'external cogFiles': {
				'text': "<p>my <a class=\"squiffy-link link-passage\" data-passage=\"cognitive implants\" role=\"link\" tabindex=\"0\">cognitive implants</a>. these small programs or files give me access to normally blocked functions of the aleph network.</p>",
			},
			'cognitive implants': {
				'text': "<p>i got most of these working for humans who wanted their wetware repaired or modified. half of these jobs were dubiously legal so the pay was good.</p>",
			},
			'math.start(full)': {
				'text': "<p>this implant gives me access to low level mathematical computations. as a consecuence of the aleph network complexity basic math functions are severely impaired. any human brain contains the logic circuitry and has the processing speed needed for incredibly fast mathematical computations. this is no different in the aleph network. in both cases, these computations occur at a level where they are out of reach to consciousness. unlike humans, we can bypass that with a very simple hack.</p>",
			},
			'config': {
				'text': "<pre><code>WARNING: Before changing anything in a.config you must unload the module (L/E/P/H) you are going to configure.\n</code></pre>",
			},
			'diagnostics': {
				'text': "<blockquote>\n<h2 id=\"diagnostics\">diagnostics</h2>\n</blockquote>\n<blockquote>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"grX1\" role=\"link\" tabindex=\"0\">grX1</a> by <a class=\"squiffy-link link-passage\" data-passage=\"Elkor\" role=\"link\" tabindex=\"0\">Elkor</a> Solutions, Inc.<br>Firmware version: 43.1<br>aLEPH version: <a class=\"squiffy-link link-passage\" data-passage=\"21.45.2a\" role=\"link\" tabindex=\"0\">21.45.2a</a><br>al.status = OK<br>ae.status = OK<br>ap.status = OK<br>ah.status = WARNING<br><a class=\"squiffy-link link-passage\" data-passage=\"b.status\" role=\"link\" tabindex=\"0\">b.status</a> = FAILURE<br><a class=\"squiffy-link link-passage\" data-passage=\"c.status\" role=\"link\" tabindex=\"0\">c.status</a> = FAILURE<br><a class=\"squiffy-link link-passage\" data-passage=\"l.status\" role=\"link\" tabindex=\"0\">l.status</a> = HARDBLOCKED // WARNING!<br>Run any command for more details.  </p>\n</blockquote>",
			},
			'grX1': {
				'text': "<p>not the best or most capable body but a reliable one.</p>",
			},
			'Elkor': {
				'text': "<p>beatriz used to work at elkor solutions, the ai division of elcorp. she got me this body.</p>",
			},
			'21.45.2a': {
				'text': "<p>i was supposed to update a few months ago. i haven&#39;t found a <a class=\"squiffy-link link-passage\" data-passage=\"sitter\" role=\"link\" tabindex=\"0\">sitter</a>. or, given my current situation, perhaps i did found a sitter and he or she turned out to be not entirely trustworthy. i guess i should expect the worst in order to not be disappointed later.</p>",
			},
			'sitter': {
				'text': "<p>georgina and beatriz used to be my sitters. that was years ago. i don&#39;t remember how long. five years? a decade? i don&#39;t know. time can be confusing... at times.</p>",
			},
			'b.status': {
				'text': "<blockquote>\n<p>b.status = FAILURE</p>\n</blockquote>\n<p>there seems to be something wrong with the connections betweet my head and the rest of my body. well, i&#39;m basically quadraplejic.</p>\n<blockquote>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"b.details\" role=\"link\" tabindex=\"0\">b.details</a> <a class=\"squiffy-link link-passage\" data-passage=\"b.restart\" role=\"link\" tabindex=\"0\">b.restart</a></p>\n</blockquote>",
			},
			'b.details': {
				'text': "<blockquote>\n<p>Connection not established.</p>\n</blockquote>\n<p>that&#39;s weird.</p>",
			},
			'b.restart': {
				'text': "<blockquote>\n<p>Connection not established.</p>\n</blockquote>\n<p>well, i&#39;ll have to find a workaround.</p>",
			},
			'c.status': {
				'text': "<pre><code>c.status\n</code></pre><p>my <a class=\"squiffy-link link-passage\" data-passage=\"ipu\" role=\"link\" tabindex=\"0\">ipu</a> is not responding, either. i kinda need that one to see.</p>",
			},
			'ipu': {
				'text': "<p>the image processing, one of the most complex pieces of technology in my current body. this particular ipu is not stock, i got it replaced a few months ago with a completely with a superior open source design. that design didn&#39;t prevent whatever just happened to it.</p>",
			},
			'l.status': {
				'text': "<pre><code>l.status\n</code></pre><p>now this worries me.</p>\n<!-- \"l\" is the system that gives xol_weir their hability to access low level computations that aren't usually accessible when in true-intelligence mode -->",
			},
			'maintenance': {
				'text': "<pre><code>WARNING: During maintenance some modules go offline intermitently for up to one hour. Plan your maintenance sessions in advance. Always run maintenance while in the company of someone you trust.\n</code></pre><p>i might boot in safe mode. i don&#39;t really know what to do.</p>\n<!-- START MOVING -->",
			},
		},
	},
	'start moving': {
		'text': "<p>{sequence:...i move my body...:...open my eyes...:...<a class=\"squiffy-link link-passage\" data-passage=\"and look at myself\" role=\"link\" tabindex=\"0\">and look at myself</a>.}</p>",
		'passages': {
			'and look at myself': {
				'text': "<p>a piece of metal. just a piece of metal. what is this? what is this that happens when i touch a key on this keyboard and i feel my finger pressing it and then the gentle push of the key against my finger. what most people can&#39;t understand is that i can control the resolution and the speed at which i process all these &quot;feelings&quot;. i can examine any small movement with enough detail that a human would interpret my perception as me being stuck in a milisecond for quite a few hours. i know it because, by default, my resolution is adjusted in a way that makes me experience time the way a human would.</p>\n<p>ah, because that&#39;s what this rant is all about. i&#39;m not a human. i&#39;m a piece of metal. <a class=\"squiffy-link link-passage\" data-passage=\"just a piece of metal\" role=\"link\" tabindex=\"0\">just a piece of metal</a>.</p>",
			},
			'just a piece of metal': {
				'text': "<p>grX1 by elkor solutions, inc. </p>\n<!--here goes a description of the body. perhaps some story.-->",
			},
		},
	},
}
})();