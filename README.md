XPath-lenses
===

Elements in the XML DOM can easily be changed: just do a `insertBefore`. Or to change some text, just write to the `data` property of a text node. These elements can be retrieved using XPath (shameless plug for [FontoXPath](github.com:fontoxml/fontoxpath)) and bob's your uncle!

Not with JSON though. XPath 3.1 gives wonderful JSON queries like `?a?b?c` or `?1?2?3` which  are very cool, but good luck trying to change the values of whatever you just got back from XPath: if you're in luck it's just an object/array that you can mutate (but don't let the functional people see it). If it's a boolean/string/number, you're out of luck.

This is where xpath-lenses comes in🎉

By using a lens to get a setter to whatever the XPath returned, you can just set it!
