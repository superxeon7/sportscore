import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  // ============================================
  // USERS
  // ============================================
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sportscore.com' },
    update: {},
    create: {
      email: 'admin@sportscore.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Utama',
      role: 'ADMIN',
    },
  });

  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@sportscore.com' },
    update: {},
    create: {
      email: 'organizer@sportscore.com',
      passwordHash,
      firstName: 'Panitia',
      lastName: 'Turnamen',
      role: 'ORGANIZER',
    },
  });

  const teamManager1 = await prisma.user.upsert({
    where: { email: 'manager1@sportscore.com' },
    update: {},
    create: {
      email: 'manager1@sportscore.com',
      passwordHash,
      firstName: 'Budi',
      lastName: 'Santoso',
      role: 'TEAM_MANAGER',
    },
  });

  const teamManager2 = await prisma.user.upsert({
    where: { email: 'manager2@sportscore.com' },
    update: {},
    create: {
      email: 'manager2@sportscore.com',
      passwordHash,
      firstName: 'Agus',
      lastName: 'Pratama',
      role: 'TEAM_MANAGER',
    },
  });

  const teamManager3 = await prisma.user.upsert({
    where: { email: 'manager3@sportscore.com' },
    update: {},
    create: {
      email: 'manager3@sportscore.com',
      passwordHash,
      firstName: 'Andi',
      lastName: 'Wijaya',
      role: 'TEAM_MANAGER',
    },
  });

  const teamManager4 = await prisma.user.upsert({
    where: { email: 'manager4@sportscore.com' },
    update: {},
    create: {
      email: 'manager4@sportscore.com',
      passwordHash,
      firstName: 'Rizki',
      lastName: 'Ramadhan',
      role: 'TEAM_MANAGER',
    },
  });

  console.log('Users created');

  // ============================================
  // SPORTS
  // ============================================
  const football = await prisma.sport.upsert({
    where: { slug: 'football' },
    update: {},
    create: {
      name: 'Football',
      slug: 'football',
      icon: 'football',
      description: 'Association football (soccer)',
      rules: {
        periods: 2,
        periodDuration: 45,
        halfTime: true,
        extraTime: { enabled: true, periods: 2, periodDuration: 15 },
        penalties: true,
        maxSubstitutions: 5,
        playersOnField: 11,
      },
      scoringSystem: {
        scoringEvents: [
          { eventType: 'GOAL', points: 1, forOpponent: false },
          { eventType: 'OWN_GOAL', points: 1, forOpponent: true },
          { eventType: 'PENALTY', points: 1, forOpponent: false },
        ],
        periods: [
          { label: '1st Half', duration: 45 },
          { label: '2nd Half', duration: 45 },
        ],
        hasExtraTime: true,
        hasPenaltyShootout: true,
      },
      eventTypes: [
        'GOAL', 'ASSIST', 'OWN_GOAL', 'PENALTY',
        'YELLOW_CARD', 'RED_CARD', 'GREEN_CARD', 'SUBSTITUTION',
        'FOUL', 'PERIOD_START', 'PERIOD_END',
      ],
      displayConfig: {
        scoreFormat: '{home} - {away}',
        periodNames: ['1st Half', '2nd Half'],
        extraPeriodNames: ['Extra Time 1st Half', 'Extra Time 2nd Half'],
        showMinutes: true,
      },
    },
  });

  const futsal = await prisma.sport.upsert({
    where: { slug: 'futsal' },
    update: {},
    create: {
      name: 'Futsal',
      slug: 'futsal',
      icon: 'football',
      description: 'Indoor football (futsal)',
      rules: {
        periods: 2,
        periodDuration: 20,
        halfTime: true,
        extraTime: { enabled: true, periods: 2, periodDuration: 5 },
        penalties: true,
        maxSubstitutions: 12,
        playersOnField: 5,
      },
      scoringSystem: {
        scoringEvents: [
          { eventType: 'GOAL', points: 1, forOpponent: false },
          { eventType: 'OWN_GOAL', points: 1, forOpponent: true },
          { eventType: 'PENALTY', points: 1, forOpponent: false },
        ],
        periods: [
          { label: '1st Half', duration: 20 },
          { label: '2nd Half', duration: 20 },
        ],
        hasExtraTime: true,
        hasPenaltyShootout: true,
      },
      eventTypes: [
        'GOAL', 'ASSIST', 'OWN_GOAL', 'PENALTY',
        'YELLOW_CARD', 'RED_CARD', 'GREEN_CARD', 'SUBSTITUTION',
        'FOUL', 'PERIOD_START', 'PERIOD_END',
      ],
      displayConfig: {
        scoreFormat: '{home} - {away}',
        periodNames: ['1st Half', '2nd Half'],
        extraPeriodNames: ['Extra Time 1st Half', 'Extra Time 2nd Half'],
        showMinutes: true,
      },
    },
  });

  const basketball = await prisma.sport.upsert({
    where: { slug: 'basketball' },
    update: {},
    create: {
      name: 'Basketball',
      slug: 'basketball',
      icon: 'basketball',
      description: 'Basketball',
      rules: {
        periods: 4,
        periodDuration: 12,
        overtime: { enabled: true, duration: 5 },
        timeouts: { perHalf: 4 },
        playersOnCourt: 5,
      },
      scoringSystem: {
        POINT: {
          variants: {
            '2pt': { points: 2, affectsScore: true },
            '3pt': { points: 3, affectsScore: true },
            'ft': { points: 1, affectsScore: true },
          },
        },
      },
      eventTypes: ['POINT', 'FOUL', 'TIMEOUT', 'SUBSTITUTION', 'PERIOD_START', 'PERIOD_END'],
      displayConfig: {
        scoreFormat: '{home} - {away}',
        periodNames: ['Q1', 'Q2', 'Q3', 'Q4'],
        showMinutes: true,
      },
    },
  });

  const volleyball = await prisma.sport.upsert({
    where: { slug: 'volleyball' },
    update: {},
    create: {
      name: 'Volleyball',
      slug: 'volleyball',
      icon: 'volleyball',
      description: 'Indoor volleyball',
      rules: {
        maxSets: 5,
        pointsToWinSet: 25,
        pointsToWinFinalSet: 15,
        minPointAdvantage: 2,
        setsToWin: 3,
        playersOnCourt: 6,
      },
      scoringSystem: {
        POINT: { points: 1, affectsScore: true },
      },
      eventTypes: ['POINT', 'SUBSTITUTION', 'TIMEOUT', 'PERIOD_START', 'PERIOD_END'],
      displayConfig: {
        scoreFormat: '{home} - {away} (sets: {homeSets}-{awaySets})',
        periodNames: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
        showMinutes: false,
      },
    },
  });

  console.log('Sports created');

  // ============================================
  // TEAMS
  // ============================================
  const team1 = await prisma.team.upsert({
    where: { slug: 'garuda-muda' },
    update: {},
    create: {
      name: 'Garuda Muda FC',
      shortName: 'GMF',
      slug: 'garuda-muda',
      city: 'Jakarta',
      country: 'Indonesia',
      foundedYear: 2020,
      sportType: 'FOOTBALL',
      ageGroup: 'SENIOR',
      gender: 'MALE',
      managerId: teamManager1.id,
    },
  });

  const team2 = await prisma.team.upsert({
    where: { slug: 'rajawali-fc' },
    update: {},
    create: {
      name: 'Rajawali FC',
      shortName: 'RJW',
      slug: 'rajawali-fc',
      city: 'Surabaya',
      country: 'Indonesia',
      foundedYear: 2019,
      sportType: 'FOOTBALL',
      ageGroup: 'SENIOR',
      gender: 'MALE',
      managerId: teamManager2.id,
    },
  });

  const team3 = await prisma.team.upsert({
    where: { slug: 'elang-jaya' },
    update: {},
    create: {
      name: 'Elang Jaya United',
      shortName: 'EJU',
      slug: 'elang-jaya',
      city: 'Bandung',
      country: 'Indonesia',
      foundedYear: 2021,
      sportType: 'FOOTBALL',
      ageGroup: 'SENIOR',
      gender: 'MALE',
      managerId: teamManager3.id,
    },
  });

  const team4 = await prisma.team.upsert({
    where: { slug: 'banteng-merah' },
    update: {},
    create: {
      name: 'Banteng Merah SC',
      shortName: 'BMS',
      slug: 'banteng-merah',
      city: 'Yogyakarta',
      country: 'Indonesia',
      foundedYear: 2018,
      sportType: 'FOOTBALL',
      ageGroup: 'SENIOR',
      gender: 'MALE',
      managerId: teamManager4.id,
    },
  });

  console.log('Teams created');

  // ============================================
  // PLAYERS
  // ============================================
  const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'LW', 'RW', 'CF', 'ST'];

  const playerNames: Record<string, { first: string; last: string }[]> = {
    [team1.id]: [
      { first: 'Arya', last: 'Pratama' }, { first: 'Dimas', last: 'Saputra' },
      { first: 'Fajar', last: 'Nugroho' }, { first: 'Galih', last: 'Wicaksono' },
      { first: 'Hendra', last: 'Kurniawan' }, { first: 'Irfan', last: 'Hakim' },
      { first: 'Joko', last: 'Susilo' }, { first: 'Kevin', last: 'Sanjaya' },
      { first: 'Lutfi', last: 'Hidayat' }, { first: 'Mahesa', last: 'Putra' },
      { first: 'Naufal', last: 'Azzam' },
    ],
    [team2.id]: [
      { first: 'Oki', last: 'Firmansyah' }, { first: 'Putu', last: 'Dharma' },
      { first: 'Raka', last: 'Aditya' }, { first: 'Surya', last: 'Wibowo' },
      { first: 'Taufik', last: 'Rahman' }, { first: 'Umar', last: 'Faruq' },
      { first: 'Vino', last: 'Bastian' }, { first: 'Wahyu', last: 'Setiawan' },
      { first: 'Yoga', last: 'Permana' }, { first: 'Zaki', last: 'Maulana' },
      { first: 'Ahmad', last: 'Faisal' },
    ],
    [team3.id]: [
      { first: 'Bayu', last: 'Anggara' }, { first: 'Candra', last: 'Dewanto' },
      { first: 'Deni', last: 'Purnama' }, { first: 'Eko', last: 'Prasetyo' },
      { first: 'Febri', last: 'Hardiansyah' }, { first: 'Gilang', last: 'Ramadhan' },
      { first: 'Hanif', last: 'Abdullah' }, { first: 'Ivan', last: 'Kolev' },
      { first: 'Jihan', last: 'Farhan' }, { first: 'Krisna', last: 'Adi' },
      { first: 'Leo', last: 'Situmorang' },
    ],
    [team4.id]: [
      { first: 'Maman', last: 'Suryaman' }, { first: 'Nasrul', last: 'Alam' },
      { first: 'Oscar', last: 'Iwan' }, { first: 'Pandu', last: 'Wibisono' },
      { first: 'Rendi', last: 'Irawan' }, { first: 'Samsul', last: 'Arif' },
      { first: 'Teguh', last: 'Prakarsa' }, { first: 'Ujang', last: 'Suryana' },
      { first: 'Veri', last: 'Gunawan' }, { first: 'Wawan', last: 'Hermawan' },
      { first: 'Yusuf', last: 'Maulana' },
    ],
  };

  for (const team of [team1, team2, team3, team4]) {
    const names = playerNames[team.id];
    for (let i = 0; i < 11; i++) {
      await prisma.player.create({
        data: {
          fullName: `${names[i].first} ${names[i].last}`,
          jerseyNumber: i === 0 ? 1 : i + 1,
          position: positions[i],
          dateOfBirth: new Date('2000-01-01'),
          teamId: team.id,
          nationality: 'Indonesia',
          stats: {},
        },
      });
    }
  }

  console.log('Players created');

  // ============================================
  // EVENT
  // ============================================
  const event = await prisma.event.upsert({
    where: { slug: 'piala-nusantara-2026' },
    update: {},
    create: {
      name: 'Piala Nusantara 2026',
      slug: 'piala-nusantara-2026',
      description: 'Turnamen sepak bola antar kota se-Indonesia',
      location: 'Jakarta',
      venue: 'Stadion Utama Gelora Bung Karno',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      status: 'PUBLISHED',
      sportId: football.id,
      organizerId: organizer.id,
      maxTeams: 8,
    },
  });

  console.log('Event created');

  // ============================================
  // EVENT CATEGORIES (per-event, with time config & DOB rules)
  // ============================================
  const seniorMaleFootball = await prisma.eventCategory.upsert({
    where: {
      eventId_name: { eventId: event.id, name: 'Sepak Bola Putra Senior' },
    },
    update: {},
    create: {
      name: 'Sepak Bola Putra Senior',
      eventId: event.id,
      sportType: 'FOOTBALL',
      gender: 'MALE',
      maxDateOfBirth: new Date('1990-01-01'),
      matchDurationMinutes: 90,
      halfCount: 2,
      breakDurationMinutes: 15,
      injuryTimeMinutes: 3,
    },
  });

  const u12MaleFutsal = await prisma.eventCategory.upsert({
    where: {
      eventId_name: { eventId: event.id, name: 'Futsal Putra U-12' },
    },
    update: {},
    create: {
      name: 'Futsal Putra U-12',
      eventId: event.id,
      sportType: 'FUTSAL',
      gender: 'MALE',
      maxDateOfBirth: new Date('2014-01-01'),
      matchDurationMinutes: 40,
      halfCount: 2,
      breakDurationMinutes: 10,
      injuryTimeMinutes: 0,
    },
  });

  console.log('Event categories created');

  // Register teams to event category
  for (const team of [team1, team2, team3, team4]) {
    await prisma.eventCategoryTeam.upsert({
      where: {
        eventCategoryId_teamId: { eventCategoryId: seniorMaleFootball.id, teamId: team.id },
      },
      update: {},
      create: {
        eventCategoryId: seniorMaleFootball.id,
        teamId: team.id,
      },
    });
  }

  // ============================================
  // TOURNAMENT
  // ============================================
  const tournament = await prisma.tournament.upsert({
    where: { id: 'seed-tournament-1' },
    update: {},
    create: {
      id: 'seed-tournament-1',
      name: 'Liga Piala Nusantara',
      type: 'LEAGUE',
      status: 'REGISTRATION',
      eventId: event.id,
      eventCategoryId: seniorMaleFootball.id,
      config: {
        rounds: 2,
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
      },
    },
  });

  console.log('Tournament created');

  // ============================================
  // MATCHES
  // ============================================
  const teams = [team1, team2, team3, team4];
  let matchDay = 1;
  const baseDate = new Date('2026-06-05');

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          homeTeamId: teams[i].id,
          awayTeamId: teams[j].id,
          eventCategoryId: seniorMaleFootball.id,
          scheduledAt: new Date(baseDate.getTime() + matchDay * 3 * 24 * 60 * 60 * 1000),
          venue: 'Stadion Utama GBK',
          round: 1,
          matchDay: matchDay,
        },
      });
      matchDay++;
    }
  }

  console.log('Matches created');

  // ============================================
  // TEAM OFFICIALS
  // ============================================
  const officialData = [
    { team: team1, name: 'Coach Surya Wijaya', role: 'COACH' as const },
    { team: team1, name: 'Asep Firmansyah', role: 'ASSISTANT_COACH' as const },
    { team: team1, name: 'Dr. Hadi Pranoto', role: 'PHYSIO' as const },
    { team: team2, name: 'Coach Bambang Hartono', role: 'COACH' as const },
    { team: team2, name: 'Rudi Setiawan', role: 'ASSISTANT_COACH' as const },
    { team: team2, name: 'Dr. Maya Sari', role: 'PHYSIO' as const },
    { team: team3, name: 'Coach Dedi Kusuma', role: 'COACH' as const },
    { team: team3, name: 'Eko Prasetyo', role: 'ASSISTANT_COACH' as const },
    { team: team4, name: 'Coach Fahri Rahman', role: 'COACH' as const },
    { team: team4, name: 'Joko Widodo', role: 'MANAGER' as const },
  ];

  for (const od of officialData) {
    await prisma.teamOfficial.create({
      data: {
        teamId: od.team.id,
        fullName: od.name,
        role: od.role,
        dateOfBirth: new Date('1980-01-15'),
        nationality: 'Indonesia',
      },
    });
  }

  console.log('Team officials created');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
