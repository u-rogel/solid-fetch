import { useEffect } from 'react'
import logo from './logo.svg';
import './App.css';
import SolidFetch from 'solid-fetch';

const FetchClient = new SolidFetch({
  initInjectables: {
    apiUrl: () => 'https://my-json-server.typicode.com'
  }
})

function App() {
  useEffect(() => {
    console.log('render')
    FetchClient.request`${p => p.apiUrl}/typicode/demo/posts`({
      query: (p) => ({
        hell: 'world',
        a: p.apiUrl
      }),
    })
      .then((res) => {
        console.log({ res});
        
      })
  }, [])
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
