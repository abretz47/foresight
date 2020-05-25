const initialState = { user: {id:"",name:""} };

export default function reducer(state = initialState){
    return state;
}

export function getUser() {
    return {
      type: "GET_USER"
    };
  }