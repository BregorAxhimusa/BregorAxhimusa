// Reads the contribution calendar from the GitHub GraphQL API, one year per
// request (the API caps a contributionsCollection range at one year).

const ENDPOINT = 'https://api.github.com/graphql';

const QUERY = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      createdAt
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

type CalendarResponse = {
  data?: {
    user: {
      createdAt: string;
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
        };
      };
    } | null;
  };
  errors?: { message: string }[];
};

async function request(token: string, variables: Record<string, string>): Promise<NonNullable<CalendarResponse['data']>> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'bregoraxhimusa-profile',
    },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as CalendarResponse;
  if (body.errors?.length) throw new Error(`GitHub GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  if (!body.data?.user) throw new Error(`GitHub user "${variables.login}" not found`);
  return body.data;
}

// Every calendar day since the account was created, keyed by date.
export async function fetchContributions(token: string, login: string, now: Date): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  let to = now;
  let createdAt: Date | null = null;

  while (!createdAt || to > createdAt) {
    const from = new Date(to);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    const data = await request(token, { login, from: from.toISOString(), to: to.toISOString() });
    createdAt ??= new Date(data.user!.createdAt);
    for (const week of data.user!.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        // Neighbouring ranges share their edge day; keep the larger reading.
        counts.set(day.date, Math.max(counts.get(day.date) ?? 0, day.contributionCount));
      }
    }
    to = from;
  }
  return counts;
}
