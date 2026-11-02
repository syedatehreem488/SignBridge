import Camera from './components/Camera';
export default function App() {
  return <div style={{ maxWidth: 640 }}><Camera onFrame={(frame) => console.log(frame.length, 'hands')} /></div>;
}