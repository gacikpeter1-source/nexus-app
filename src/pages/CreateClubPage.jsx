import React from 'react';
import CreateClubWithSubscription from '../components/CreateClubWithSubscription';
import { Link } from 'react-router-dom';

export default function CreateClubPage() {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-light/70 hover:text-light mb-6 transition-colors"
        >
          ← Back to Dashboard
        </Link>
        
        <CreateClubWithSubscription />
      </div>
    </div>
  );
}