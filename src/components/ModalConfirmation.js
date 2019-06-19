import React from 'react';
import { Dimensions, Image, Platform, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';

class ModalConfirmation extends React.Component {
  /**
   * show {boolean} If should show the modal component
   */
  state = {
    show: false,
  }

  show = () => {
    this.setState({ show: true }, () => {
      if (this.props.onShow) {
        this.props.onShow();
      }
    });
  }

  hide = () => {
    this.setState({ show: false }, () => {
      if (this.props.onHide) {
        this.props.onHide();
      }
    });
  }

  render() {
    if (!this.state.show) {
      return null;
    }

    const { height, width } = Dimensions.get('window');

    // Prevent the bottom message to be covered by some android phones
    const marginBottom = Platform.OS === 'android' ? 40 : 16;

    const styles = StyleSheet.create({
      modal: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 3,
        height: height,
        width: width,
      },
      innerModal: {
        marginBottom: marginBottom,
        height: 270,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderRadius: 8,
        padding: 16,
        width: width - 32,
      },
    });
    return (
      <TouchableWithoutFeedback onPress={this.hide}>
        <View style={styles.modal}>
          <View style={styles.innerModal}>
            <Image source={require('../assets/images/icCheckBig.png')} style={{height: 105, width: 105}} resizeMode={"contain"} />
            {this.props.body}
          </View>
        </View>
      </TouchableWithoutFeedback>
    )
  }
}


export default ModalConfirmation;
