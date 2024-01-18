import React from 'react';
import ReactDOM from 'react-dom/client';
function App() {
	return <div>222</div>;
}
const jsx = (
	<div>
		<App></App>
	</div>
);
console.log(<App />);
ReactDOM.createRoot(document.getElementById('root')!).render(jsx);
