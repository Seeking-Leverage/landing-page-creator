"use strict";

const ALLOWED = new Set([
  "$schema",
  "$id",
  "title",
  "description",
  "type",
  "additionalProperties",
  "required",
  "properties",
  "minLength",
  "maxLength",
  "pattern",
  "enum",
  "maxItems",
  "items",
]);

function walkSchema(schema, at) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  for (const key of Object.keys(schema)) {
    if (!ALLOWED.has(key)) {
      throw new Error("schema keyword not enforced: " + key + " at " + at);
    }
  }
  if (schema.properties) {
    for (const [name, child] of Object.entries(schema.properties)) walkSchema(child, at + "." + name);
  }
  if (schema.items) walkSchema(schema.items, at + "[]");
}

function fail(errors, path, message) {
  errors.push(path + " " + message);
}

function check(data, schema, path, errors) {
  if (schema.type === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      fail(errors, path, "must be an object");
      return;
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) fail(errors, path + "." + key, "is not allowed");
      }
    }
    for (const key of schema.required || []) {
      if (data[key] === undefined) fail(errors, path + "." + key, "is required");
    }
    for (const [key, child] of Object.entries(props)) {
      if (data[key] !== undefined) check(data[key], child, path + "." + key, errors);
    }
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(data)) {
      fail(errors, path, "must be an array");
      return;
    }
    if (schema.maxItems != null && data.length > schema.maxItems) {
      fail(errors, path, "has " + data.length + " items, max " + schema.maxItems);
    }
    if (schema.items) data.forEach((item, i) => check(item, schema.items, path + "[" + i + "]", errors));
    return;
  }
  if (schema.type === "string") {
    if (typeof data !== "string") {
      fail(errors, path, "must be a string");
      return;
    }
    if (schema.minLength != null && data.length < schema.minLength) fail(errors, path, "is too short");
    if (schema.maxLength != null && data.length > schema.maxLength) fail(errors, path, "is too long");
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) fail(errors, path, "does not match " + schema.pattern);
    if (schema.enum && !schema.enum.includes(data)) fail(errors, path, "must be one of " + schema.enum.join(", "));
    return;
  }
  if (schema.type === "boolean") {
    if (typeof data !== "boolean") fail(errors, path, "must be true or false");
    return;
  }
  throw new Error("schema type not enforced: " + schema.type + " at " + path);
}

function validate(data, schema, label) {
  walkSchema(schema, label || "schema");
  const errors = [];
  check(data, schema, label || "$", errors);
  return errors;
}

module.exports = { validate };
