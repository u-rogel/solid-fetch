## Solid-Fetch

SolidFetch is created with one goal in mind, to make client-server communication as easy as possible.
These means: less code, less headache and more power over the communication channel.


### Core tools
Supporting injectable request properties in url, parameters, search-query and headers.
Supporting intercepting requests, responses and errors to easily control and maintain communication with servers. 

## Install

```bash
yarn add solid-fetch
```

or:

```bash
npm install solid-fetch
```

## Usage

The module needs to get first things the fetch function to use:
Browser: `fetch`
Node: `node-fetch`

```js
import SolidFetch from 'solid-fetch'

SolidFetch.setConfig({
  systemFetch: window.fetch.bind(window),
})

SolidFetch.request`http://test-server.io/messages`()
  .then((res) => {
    console.log('result from SolidFetch')
  })
  .catch((err) => {
    console.log('error from SolidFetch')
  })

```

**in the browser use-case the fetch needs to be handed over like shown in the example*

### Config Props

| Prop           | Type      | Default |  Description            |
|----------------|-----------|---------|-------------------------|
| systemFetch    | <Fetch>   | null    | The fetch function SolidFetch should use. Normally the standard `fetch` in the browser or `node-fetch` in node. |
| globalHeaders  | `Object`  | {}      | Global headers to be injected to all requests |
| globalQuery    | `Object`  | {}      | Global search-query params to be injected to all requests |
| interceptedReq | `Array`   | []      | Array of interceptors to run before request is sent |
| interceptedRes | `Array`   | []      | Array of interceptors to run after response is received |
| interceptedErr | `Array`   | []      | Array of interceptors to run after error is received |

## Injections

SolidFetch comes very handy when you have plenty of dynamic props that needs to create the request.
Using SolidFetch you can give the module pieces of data that you would like to use later, ex.
access-token, language or user-id.

The example shows the injectables being set at one spot, but you can set them as many times as you want from
where ever you need. Also by setting the two objects will be merged, only former existing fields will be overwritten.

```js
import SolidFetch from 'solid-fetch'

SolidFetch.setInjectables({
  language: 'de',
  userId: '123',
  jwtToken: 'abc'
})
```

### Injections Per Request

After setting the injectables you can just refer to it during the request construction since the module 
is already aware of it.

```js
import SolidFetch from 'solid-fetch'

// Injection in URL
SolidFetch.request`http://test-server.io/${(p) => p.language}/messages`({
  query: {
    // Injection in search-query
    language: (p) => p.language
  }
  headers: {
    // Injection in headers
    Authorization: (p) => `Bearer ${p.jwtToken}`
  },
  body: (p) => ({
    // Injection in body
    userId: p.userId
  })
})
  .then((res) => {
    console.log('result from SolidFetch')
  })
  .catch((err) => {
    console.log('error from SolidFetch')
  })
```

**Note: Body can be resolved in two ways**
* Less intuitive but fits for object with nested keys:
```js
SolidFetch.request`url`({
  body: (p) => ({
    // Injection in body
    userId: p.userId
  })
})
```

* Similar to the other injections but works only with first level keys:
```js
SolidFetch.request`url`({
  body: {
    // Injection in body
    userId: (p) => p.userId
  }
})
```

### Global Injections

Same like injectables per a request, you can set to all requests globally added values on headers and search-query.
They will be added to the request without further code. The header or search-query can be overwritten per specific
request by giving the prop with a different value.

```js
import SolidFetch from 'solid-fetch'

SolidFetch.setConfig({
  globalHeaders: {
    Authorization: (p) => `Bearer ${p.jwtToken}`
  }
})

SolidFetch.request`http://test-server.io/${p => p.language}/messages`({
  query: {
    language: p => p.language
  }
  // No need to set Authorization header since it will be added to all requests
})
  .then((res) => {
    console.log('result from SolidFetch')
  })
  .catch((err) => {
    console.log('error from SolidFetch')
  })
```

## Interceptions

SolidFetch gives the ability to intercept all outgoing and incoming communication. That can be useful for
error logging, caching, usage-statistics, etc.

Interceptor is an object which must have an `action` property, it is recommended to add `name` or any other
identifier to the interceptor for further references. Interceptor `action` can mutate the current value of the action or just to cause side-effects.

Since you might want to run more than one interception, interceptions are stored in arrays and will be
executed in sequence. If *nothing returned* from the interceptor, the *next* interceptor will run on the
*last* generated value. The interceptors are reduce functions that will in the end have a similar structure to the
data needed.

### Request Interception

```js
import SolidFetch from 'solid-fetch'

SolidFetch.setConfig({
  interceptedReq: [{
    name: 'debugging',
    action: (request) => {
      console.log('caught a request')
      console.log({ request })
    },
  }],
})
```

### Response Interception

Response interceptors will get the result of the request after processing. Means, only if it has
status of 200, also if it is `application/json` then the parsed json will be given, otherwise just
the raw response value. 

```js
import SolidFetch from 'solid-fetch'

SolidFetch.setConfig({
  interceptedRes: [{
    name: 'debugging',
    action: (result) => {
      console.log('caught a response')
      statisticService.post(result)
    },
  }],
})
```

### Error Interception

Error interceptors will get the error data of the request. 

```js
import SolidFetch from 'solid-fetch'

SolidFetch.setConfig({
  interceptedErr: [{
    name: 'error-tracer',
    action: (error) => {
      console.log('caught a response')
      errorTracer.postError(error)
    },
  }],
})
```

**If the status code is NOT 200-299, an error will be thrown.*

### Request, Response, Error Shape

Request:

```js
{
  url: String,
  requestOptions: {
    method: String = 'GET',
    headers: Object = {},
    query: Object = {},
    body: String,
  }
}
```

Response:

```js
{
  data: <ParsedResult> || <RawResponse>,
  headers: Object,
  ok: Boolean,
  redirected: Boolean,
  size: Number,
  status: Number,
  statusText: String,
  request: {
    url: String,
    requestOptions: {
      method: String = 'GET',
      headers: Object = {},
      query: Object = {},
      body: String,
    }
  }
}
```

Standard JS Error with JSON content:

```js
{
  name: String,
  description: String,
  response: <RawResponse>, // optional
  request: {
    url: String,
    requestOptions: {
      method: String = 'GET',
      headers: Object = {},
      query: Object = {},
      body: String,
    }
  }
}
```

## Advanced

If you need more than one SolidFetch client for communication with several servers. You can
import an instance from the module and then consume the instance instead

```js
import { instance } from 'solid-fetch'

const SolidFetchChatApi = instance()

SolidFetchChatApi.setConfig({
  ...
})
```

Use your solid-fetch configs outside of it

```js
import SolidFetch from 'solid-fetch'

const { useId, jwtToken } = SolidFetch.getInjectables()
```