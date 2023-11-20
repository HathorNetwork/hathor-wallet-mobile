import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from "@react-navigation/native";
import { t } from 'ttag';
import { isEmpty } from 'lodash';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { showPinScreenForResult } from '../../sagas/helpers';

const initialState = {
  tokenA: '',
  tokenB: '',
  depositTokenA: 0,
  depositTokenB: 0,
  multiplierA: 1,
  multiplierB: 1,
};

/**
 * Verifies if the invalidModel of the form has an error message.
 */
function hasError(invalidModel) {
  return Object
    .values({ ...invalidModel })
    .reduce((_hasError, currValue) => _hasError || !isEmpty(currValue), false);
}

/**
 * Validates the formModel, returning the invalidModel.
 * If there is no error in the formModel, the invalidModel is returned empty.
 */
function validate(formModel) {
  const invalidModel = {};

  if (!formModel.tokenA) {
    invalidModel.tokenA = t`tokenA is required.`;
  }

  if (!formModel.tokenB) {
    invalidModel.tokenB = t`tokenB is required.`;
  }

  if (!formModel.multiplierA) {
    invalidModel.multiplierA = t`multiplierA is required.`;
  }

  if (!formModel.multiplierB) {
    invalidModel.multiplierB = t`multiplierB is required.`;
  }

  if (formModel.depositTokenA && !Number.isInteger(Number.parseInt(formModel.depositTokenA))) {
    invalidModel.depositTokenA = t`depositTokenA must be a number.`;
  }

  if (formModel.depositTokenB && !Number.isInteger(Number.parseInt(formModel.depositTokenB))) {
    invalidModel.depositTokenB = t`depositTokenB must be a number.`;
  }

  if (formModel.multiplierA && !Number.isInteger(Number.parseInt(formModel.multiplierA))) {
    invalidModel.multiplierA = t`multiplierA must be a number.`;
  }

  if (formModel.multiplierB && !Number.isInteger(Number.parseInt(formModel.multiplierB))) {
    invalidModel.multiplierB = t`multiplierB must be a number.`;
  }

  return invalidModel;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 48,
  },
  feedbackModalIcon: {
    height: 105,
    width: 105
  },
  input: {
    marginBottom: 24,
  },
  buttonContainer: {
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
});

export const NanoContractSwapInitializeNav = Symbol('NanoContractSwapInitialize').toString();

export const NanoContractSwapInitialize = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const wallet = useSelector((state) => state.wallet);
  const address = useSelector((state) => state.lastSharedAddress);
  const dispatch = useDispatch();

  const { title, blueprintId } = route.params;

  const [formModel, setFormModel] = useState(initialState);
  const [invalidModel, setInvalidModel] = useState({});

  /* @param {'tokenA' | 'tokenB' | 'multiplierA' | 'multiplierB' } name */
  const handleInputChange = (name) => (value) => {
    // update invalid model
    const invalidModelCopy = { ...invalidModel };
    delete invalidModelCopy[name];
    setInvalidModel(invalidModelCopy);

    // update form model
    const form = {
      ...formModel,
      [name]: value,
    };
    setFormModel(form);

    // validate form model and update invalid model
    setInvalidModel({
      ...invalidModelCopy,
      [name]: validate(form)[name],
    });
  };

  const handleSubmit = async () => {
    const newInvalidModel = validate(formModel);
    if (hasError(newInvalidModel)) {
      setInvalidModel(newInvalidModel);
      return;
    }

    const method = 'initialize';
    console.log('last address', address);
    // const pinCode = await showPinScreenForResult(dispatch);
    const pinCode = await showPinScreenForResult(dispatch);
    console.log('pinCode', pinCode);
    const options = { pinCode };
    // TODO: transform hashes em bytes
	const data = {
      args: [
        {
          type: 'byte',
          value: formModel.tokenA
        },
        {
          type: 'byte',
          value: formModel.tokenB
        },
        {
          type: 'int',
          value: formModel.multiplierA
        },
        {
          type: 'int',
          value: formModel.multiplierB
        }
      ]
    };

    await wallet.createAndSendNanoContractTransaction(
      blueprintId,
      method,
      address,
      data,
      options
    );
  };

  return (
    <View style={styles.container}>
      <HathorHeader
        title={title.toUpperCase()}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <SimpleInput
          containerStyle={styles.input}
          label={t`Token A`}
          autoFocus
          onChangeText={handleInputChange('tokenA')}
          error={invalidModel.tokenA}
          value={formModel.tokenA}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Deposit Token A`}
          autoFocus
          onChangeText={handleInputChange('depositTokenA')}
          error={invalidModel.depositTokenA}
          value={formModel.depositTokenA}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Multiplier Token A`}
          autoFocus
          onChangeText={handleInputChange('multiplierA')}
          error={invalidModel.multiplierA}
          value={formModel.multiplierA}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Token B`}
          autoFocus
          onChangeText={handleInputChange('tokenB')}
          error={invalidModel.tokenB}
          value={formModel.tokenB}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Deposit Token B`}
          autoFocus
          onChangeText={handleInputChange('depositTokenB')}
          error={invalidModel.depositTokenB}
          value={formModel.depositTokenB}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Multiplier Token B`}
          autoFocus
          onChangeText={handleInputChange('multiplierB')}
          error={invalidModel.multiplierB}
          value={formModel.multiplierB}
        />

        <View style={styles.buttonContainer}>
          <NewHathorButton
            disabled={hasError(invalidModel)}
            onPress={handleSubmit}
            title={t`Send`}
          />
        </View>
      </View>
    </View>
  );
};
