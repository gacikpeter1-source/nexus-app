import { Link } from 'react-router-dom';

export default function TeamCard({ team }) {
  return (
    <Link to={`/teams/${team.id}`} className="block p-4 bg-white rounded shadow hover:shadow-md transition">
      <h3 className="text-lg font-semibold">{team.name}</h3>
      <p className="text-sm text-gray-500">{team.city}</p>
    </Link>
  );
}
