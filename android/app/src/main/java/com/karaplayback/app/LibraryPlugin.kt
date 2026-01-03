package com.karaplayback.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

@CapacitorPlugin(name = "Library")
class LibraryPlugin : Plugin() {
    @PluginMethod
    @Suppress("unused")
    fun getLibraryItems(call: PluginCall) {
        val result = JSObject()
        val items = JSONArray()

        val item1 = JSObject()
        item1.put("id", "item1")
        item1.put("title", "My First Song")
        items.put(item1)

        val item2 = JSObject()
        item2.put("id", "item2")
        item2.put("title", "Another Great Tune")
        items.put(item2)

        result.put("items", items)
        call.resolve(result)
    }
}
