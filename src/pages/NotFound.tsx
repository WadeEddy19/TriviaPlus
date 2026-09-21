import { Link } from 'react-router-dom';

export function NotFound({ message = 'Page not found.' }: { message?: string }) {
  return (
    <main className="page narrow center">
      <h1>Hmm.</h1>
      <p>{message}</p>
      <Link className="btn btn-primary" to="/">
        Back to start
      </Link>
    </main>
  );
}
