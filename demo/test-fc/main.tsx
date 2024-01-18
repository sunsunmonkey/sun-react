import { useState } from 'react';
import ReactDOM from 'react-dom/client';
function App() {
	const [num] = useState(100);

	return <div>{num}</div>;
}
// const jsx = (
// 	<div>
// 		<App></App>
// 	</div>
// );
// console.log(<App />);
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
