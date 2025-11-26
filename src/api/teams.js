import api from './apiClient';

export const getTeams = () => api.get('/teams').then(r => r.data);
export const getTeam = (id) => api.get(`/teams/${id}`).then(r => r.data);
