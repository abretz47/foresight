interface User {
  id: string;
  name: string;
}

interface AppState {
  user: User;
}

const initialState: AppState = { user: { id: '', name: '' } };

export default function reducer(state: AppState = initialState): AppState {
  return state;
}

export function getUser() {
  return {
    type: 'GET_USER',
  };
}
