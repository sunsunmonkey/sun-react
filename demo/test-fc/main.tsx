import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

function App() {
	const [num, update] = useState(100);
	return (
		<ul
			onClick={() => {
				update(50);
				update(1000);
				update(20);
				update(1);
			}}
		>
			{num}
		</ul>
	);
}

// function Child({ children }) {
// 	const now = performance.now();
// 	while (performance.now() - now < 4) {}
// 	return <li>{children}</li>;
// }
// function Child() {
// 	return (
// 		<ul>
// 			<>
// 				<li>1</li>
// 				<li>2</li>
// 			</>
// 			<li>3</li>
// 			<li>4</li>
// 		</ul>
// 	);
// }
// const jsx = (
// 	<div>
// 		<App></App>
// 	</div>
// );
// console.log(<App />);
const root = ReactDOM.createRoot(document.querySelector('#root'));

root.render(<App />);

window.root = root;
