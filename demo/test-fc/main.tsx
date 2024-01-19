import { useState } from 'react';
import ReactDOM from 'react-dom/client';
function App() {
	const [num, setNum] = useState(100);
	window.setNum = setNum;

	return num === 3 ? <Child /> : <div>{num}</div>;
}

function Child() {
	return <div>big-react</div>;
}
// const jsx = (
// 	<div>
// 		<App></App>
// 	</div>
// );
// console.log(<App />);
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
