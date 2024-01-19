import { useState } from 'react';
import ReactDOM from 'react-dom/client';
function App() {
	const [num, setNum] = useState(100);
	window.setNum = setNum;

	return <div onClickCapture={() => setNum(num + 1)}>{num}</div>;
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
