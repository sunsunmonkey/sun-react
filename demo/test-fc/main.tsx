import { useState, useEffect } from 'react';
import ReactDOM from 'react-noop-renderer';

function App() {
	return (
		<>
			<Child />
			<div>hello world</div>
		</>
	);
}

function Child() {
	return 'Child';
}
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
const root = ReactDOM.createRoot();

root.render(<App />);

window.root = root;
