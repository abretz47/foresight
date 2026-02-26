import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  template: {
    flex: 1,
    backgroundColor: '#2BBB32',
  },
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  touchableContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  buttonContainer: {
    margin: 30,
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 15,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  logoutButtonContainer: {
    position: 'relative',
    backgroundColor: 'red'
  },
  logoutButtonRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingLeft: 40,
    paddingRight: 40,
    marginLeft: 20,
    marginRight: 20,
  },
  column: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 20,
  },
  startBtn: {
    color: 'black',
  },
  label: {
    fontSize: 24,
    fontFamily: 'Helvetica Neue',
    fontWeight: 'bold',
  },
  smallLabel: {
    fontWeight: 'bold',
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#000000',
    borderWidth: 1,
    height: 50,
    fontSize: 18,
    fontWeight: 'bold',
    borderRadius: 15,
  },
  buttonDanger: {
    backgroundColor: '#FF8166',
    margin: 30,
    flex: 1,
    borderRadius: 15,
  },
  buttonSuccess: {
    flex: 1,
    margin: 30,
    backgroundColor: '#2BBB32',
    borderRadius: 15,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBottom: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalButton: {
    backgroundColor: 'lightblue',
    padding: 12,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  target: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'red',
  },
  roundButton: {
    backgroundColor: '#000000',
    borderRadius: 200,
  },
    circleLabelTop: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
  },
  circleLabelBottom: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
  },
  circleLabelInnerTop: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    textAlign: 'center',
    fontSize: 11,
    color: 'white',
  },
  circleLabelInnerBottom: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    textAlign: 'center',
    fontSize: 11,
    color: 'white',
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sliderLabel: {
    fontWeight: 'bold',
    marginHorizontal: 10,
    fontSize: 14,
  },
});
