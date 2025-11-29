// This file pretends to be a backend API

export async function fetchUsers() {
  return new Promise(resolve =>
    setTimeout(() => {
      resolve({
        trainer1: {
          id: 'trainer1',
          email: 'john.coach@email.com',
          name: 'John Smith',
          role: 'trainer',
          teams: ['team1', 'team3']
        },
        member1: {
          id: 'member1',
          email: 'alex.player@email.com',
          name: 'Alex Johnson',
          role: 'member',
          teams: ['team1', 'team2']
        },
        independent: {
          id: 'indie1',
          email: 'sam.indie@email.com',
          name: 'Sam Williams',
          role: 'independent',
          teams: []
        }
      });
    }, 300)
  );
}

export async function fetchTeams() {
  return new Promise(resolve =>
    setTimeout(() => {
      resolve({
        team1: {
          id: 'team1',
          name: 'Elite Football Club',
          sport: 'Football',
          owner: 'trainer1',
          members: ['trainer1', 'member1']
        },
        team2: {
          id: 'team2',
          name: 'Aqua Swimmers',
          sport: 'Swimming',
          owner: 'trainer2',
          members: ['member1']
        },
        team3: {
          id: 'team3',
          name: 'Ice Warriors',
          sport: 'Ice Hockey',
          owner: 'trainer1',
          members: ['trainer1']
        }
      });
    }, 300)
  );
}

export async function fetchEvents() {
  return new Promise(resolve =>
    setTimeout(() => {
      resolve([
        // Your event objects go here (same as your component)
      ]);
    }, 300)
  );
}
