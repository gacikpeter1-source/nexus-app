// src/pages/Teams.jsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTeams } from "../api/localApi";
import { Link } from "react-router-dom";
import { useAuth, ROLES } from "../contexts/AuthContext";
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Teams page — now aggregates teams from:
 *  - api/localApi.getTeams() (static/data file)
 *  - clubs stored in localStorage (clubs[].teams)
 *
 * This ensures runtime-created teams (via ClubsDashboard or DevHelper)
 * appear for the logged-in user.
 */

export default function Teams() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ["teams"],
    queryFn: getTeams
  });

  // normalize returned shape: data could be object map or array
  const staticTeamsArr = useMemo(() => {
    const d = Array.isArray(data) ? data : (data ? Object.values(data) : []);
    // defensive: ensure each team has id and arrays for members/trainers/assistants
    return (d || []).map(t => ({
      id: t.id || t._id || t.teamId || Math.random().toString(36).slice(2,8),
      name: t.name || t.title || "Unnamed Team",
      sport: t.sport || t.category || t.type || "",
      trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
      assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
      members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
      clubId: t.clubId || null,
      clubName: t.clubName || null,
    }));
  }, [data]);

  // load teams nested under clubs in localStorage
  const localClubTeams = useMemo(() => {
    try {
      const clubs = JSON.parse(localStorage.getItem("clubs") || "[]");
      if (!Array.isArray(clubs)) return [];
      const teams = [];
      for (const c of clubs) {
        if (!Array.isArray(c.teams)) continue;
        for (const t of c.teams) {
          teams.push({
            id: t.id || t._id || Math.random().toString(36).slice(2,8),
            name: t.name || t.title || "Unnamed Team",
            sport: t.sport || t.category || t.type || "",
            trainers: Array.isArray(t.trainers) ? t.trainers : (t.trainer ? [t.trainer] : []),
            assistants: Array.isArray(t.assistants) ? t.assistants : (t.assistant ? [t.assistant] : []),
            members: Array.isArray(t.members) ? t.members : (t.member ? [t.member] : []),
            clubId: c.id || null,
            clubName: c.name || null
          });
        }
      }
      return teams;
    } catch (e) {
      console.warn("Failed to read clubs from localStorage", e);
      return [];
    }
  }, [/* no deps - reads localStorage live on render */]);

  // merge both sources, dedupe by id (prefer localClubTeams if same id)
  const mergedTeams = useMemo(() => {
    const map = new Map();
    for (const t of staticTeamsArr) {
      map.set(t.id, t);
    }
    for (const t of localClubTeams) {
      map.set(t.id, t); // overwrite static if duplicate
    }
    return Array.from(map.values());
  }, [staticTeamsArr, localClubTeams]);

  if (isLoading) return <p>{t('common.loading')}...</p>;
  if (error) return <p>Error: {error.message}</p>;

  if (!user) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4">{t('nav.myTeams')}</h1>
        <p className="text-sm text-gray-600">Please sign in to see the teams you belong to.</p>
      </div>
    );
  }

  const isAdmin = user.role === ROLES.ADMIN;

  // filter teams to those where current user participates (unless admin)
  const teams = mergedTeams.filter(t => {
    if (isAdmin) return true;
    const trainers = Array.isArray(t.trainers) ? t.trainers : [];
    const assistants = Array.isArray(t.assistants) ? t.assistants : [];
    const members = Array.isArray(t.members) ? t.members : [];
    return trainers.includes(user.id) || assistants.includes(user.id) || members.includes(user.id);
  });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{t('nav.myTeams')}</h1>

      {teams.length === 0 ? (
        <div className="p-4 bg-white rounded shadow text-sm text-gray-600">
          {isAdmin
            ? "No teams found."
            : "You are not a member of any teams yet. Join a club or request to join a team to see it here."}
        </div>
      ) : (
        <ul className="space-y-3">
          {teams.map((team) => {
            const id = team.id;
            const name = team.name || "Unnamed Team";
            const sport = team.sport || "";
            const clubLabel = team.clubName ? <span className="text-gray-500"> — {team.clubName}</span> : null;
            return (
              <li key={id} className="bg-white p-3 rounded shadow-sm flex items-center justify-between">
                <div>
                  <Link to={`/teams/${id}`} className="text-blue-600 underline font-medium">
                    {name}
                  </Link>
                  {sport ? <span className="text-gray-500 ml-2">({sport})</span> : null}
                  {clubLabel}
                </div>
                <div className="text-sm text-gray-500">
                  {t('team.trainers')}: {(team.trainers || []).length} • {t('team.members')}: {(team.members || []).length}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
