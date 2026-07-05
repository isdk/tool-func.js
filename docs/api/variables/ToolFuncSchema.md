[**@isdk/tool-func**](../README.md)

***

[@isdk/tool-func](../globals.md) / ToolFuncSchema

# Variable: ToolFuncSchema

> `const` **ToolFuncSchema**: `object`

Defined in: [@isdk/ai-tools/packages/tool-func/src/tool-func.ts:1481](https://github.com/isdk/tool-func.js/blob/ce5fd396c29452d8e01479642d9655aeef531157/src/tool-func.ts#L1481)

**`Internal`**

Defines the schema for `ToolFunc` properties, used by `AdvancePropertyManager`.
This controls how properties are assigned and exported.

## Type Declaration

### alias

> **alias**: `object`

#### alias.type

> **type**: `string`[]

### asyncFeatures

> **asyncFeatures**: `object`

#### asyncFeatures.type

> **type**: `string` = `'number'`

### depends

> **depends**: `object`

#### depends.exported

> **exported**: `boolean` = `false`

#### depends.type

> **type**: `string` = `'object'`

### description

> **description**: `object`

#### description.type

> **type**: `string` = `'string'`

### func

> **func**: `object`

#### func.type

> **type**: `string` = `'function'`

#### func.assign()

> **assign**(`value`, `dest`, `src?`, `name?`, `options?`): `string` \| `Function`

##### Parameters

###### value

`string` \| `Function`

###### dest

[`ToolFunc`](../classes/ToolFunc.md)

###### src?

[`ToolFunc`](../classes/ToolFunc.md)

###### name?

`string`

###### options?

`any`

##### Returns

`string` \| `Function`

### isApi

> **isApi**: `object`

#### isApi.type

> **type**: `string` = `'boolean'`

### name

> **name**: `object`

#### name.type

> **type**: `string` = `'string'`

### params

> **params**: `object`

#### params.type

> **type**: `string` = `'object'`

### result

> **result**: `object`

#### result.type

> **type**: `string` = `'any'`

### setup

> **setup**: `object`

#### setup.type

> **type**: `string` = `'function'`

### stream

> **stream**: `object`

#### stream.type

> **type**: `string` = `'boolean'`

### tags

> **tags**: `object`

#### tags.type

> **type**: `string`[]

### title

> **title**: `object`

#### title.type

> **type**: `string` = `'string'`
