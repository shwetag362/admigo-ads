 // lib/logger.js
 
export const logger = {
  start: (msg) => console.log(`\n🏁 START → ${msg}`),
  
  info: (msg, data = null) =>
    console.log(`ℹ️ INFO → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  
  success: (msg, data = null) =>
    console.log(`✔ SUCCESS → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  
  warn: (msg, data = null) =>
    console.warn(`⚠️ WARNING → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  
  error: (msg, err) => {
    console.error(`\n❌ ERROR → ${msg}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (!err) {
      console.error("ERROR: No error object provided");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      return;
    }
    
    console.error("ERROR MESSAGE:", err?.message || err);
    
    // Try to extract structured error info if available
    if (err.code || err.subcode || err.fbtraceId) {
      console.error("\n🔍 ERROR DETAILS:");
      if (err.code) console.error(`   Code: ${err.code}`);
      if (err.subcode) console.error(`   Subcode: ${err.subcode}`);
      if (err.type) console.error(`   Type: ${err.type}`);
      if (err.fbtraceId) console.error(`   FB Trace ID: ${err.fbtraceId}`);
      if (err.userTitle) console.error(`   User Title: ${err.userTitle}`);
      if (err.userMessage) console.error(`   User Message: ${err.userMessage}`);
    }
    
    // Log the ENTIRE error object structure
    console.error("\n🔍 FULL ERROR OBJECT:");
    try {
      console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch (stringifyError) {
      console.error("(Could not stringify error object)");
      console.error(err);
    }
    
    // Stack trace (last for readability)
    if (err?.stack) {
      console.error("\n📚 STACK TRACE:");
      console.error(err.stack);
    }
    
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },
  
  meta: (msg, data = null) =>
    console.log(`🌐 META API → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  
  db: (msg, data = null) =>
    console.log(`⚡ DB → ${msg}`, data ? JSON.stringify(data, null, 2) : ""),
  
  // ⭐ NEW: Performance metrics logging
  metrics: (msg, data = null) => {
    console.log(`\n📊 PERFORMANCE METRICS → ${msg}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },
  
  // Enhanced Meta error logging
  metaError: (operation, error) => {
    console.error(`\n🚨 META API ERROR → ${operation}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Log the complete raw error first
    console.error("📦 RAW ERROR OBJECT:");
    try {
      console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.error("(Could not stringify - logging direct object)");
      console.error(error);
    }
    
    // Try to extract and display structured error from response
    if (error.response) {
      console.error("\n📛 FACEBOOK API RESPONSE ERROR:");
      console.error(JSON.stringify(error.response, null, 2));
    }
    
    // Log headers if available
    if (error.headers) {
      console.error("\n📋 RESPONSE HEADERS:");
      console.error(JSON.stringify(error.headers, null, 2));
    }
    
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },
  
  // Summary of extracted Meta error info
  metaErrorSummary: (title, errorData) => {
    console.error(`\n🎯 ${title}`);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`Error Code: ${errorData.code || 'N/A'}`);
    console.error(`Error Subcode: ${errorData.subcode || 'N/A'}`);
    console.error(`Error Type: ${errorData.type || 'N/A'}`);
    console.error(`Message: ${errorData.message || 'N/A'}`);
    
    if (errorData.userTitle) {
      console.error(`User Title: ${errorData.userTitle}`);
    }
    if (errorData.userMessage) {
      console.error(`User Message: ${errorData.userMessage}`);
    }
    if (errorData.fbtraceId) {
      console.error(`FB Trace ID: ${errorData.fbtraceId}`);
    }
    if (errorData.isTransient !== undefined) {
      console.error(`Is Transient: ${errorData.isTransient}`);
    }
    
    if (errorData.payload) {
      console.error("\n📤 REQUEST PAYLOAD THAT CAUSED ERROR:");
      console.error(JSON.stringify(errorData.payload, null, 2));
    }
    
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },
  
  // Meta response logging
  metaResponse: (operation, response) => {
    console.log(`\n✅ META API SUCCESS → ${operation}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Log the actual data returned
    const data = response?._data || response;
    console.log("📊 RESPONSE DATA:");
    console.log(JSON.stringify(data, null, 2));
    
    // Log response headers if available
    if (response?.headers) {
      console.log("\n📋 RESPONSE HEADERS:");
      console.log(JSON.stringify(response.headers, null, 2));
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },
  
  // Log request/response pair
  apiCall: (operation, request, response) => {
    console.log(`\n🔄 META API CALL → ${operation}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📤 REQUEST:");
    console.log(JSON.stringify(request, null, 2));
    console.log("\n📥 RESPONSE:");
    console.log(JSON.stringify(response?._data || response, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  },
  
  // Log validation errors
  validation: (field, value, error) => {
    console.error(`\n⚠️ VALIDATION ERROR → ${field}`);
    console.error(`Value: ${JSON.stringify(value)}`);
    console.error(`Error: ${error}\n`);
  },
  
  // Section separator
  section: (title) => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"=".repeat(60)}\n`);
  },

  // ⭐ NEW: Debug logging (only in development)
  debug: (msg, data = null) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`🐛 DEBUG → ${msg}`, data ? JSON.stringify(data, null, 2) : "");
    }
  }
};
