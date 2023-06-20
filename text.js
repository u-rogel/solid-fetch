import SolidFetch from './src/index';

interface Injectables {
  apiUrl: string
}

const SolidFetchClient = new SolidFetch<Injectables>({
  initInjectables: {
    apiUrl: () => 'https://my-json-server.typicode.com'
  }
})

SolidFetchClient.request`${p => p.apiUrl}/typicode/demo/posts`({
  query: (p) => ({
    hell: 'world',
    a: p.apiUrl
  }),
})
  .then((res) => {
    console.log({ res});
    
  })

